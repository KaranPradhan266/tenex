"use client"

import { FileUp, Trash2, Upload } from "lucide-react"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  FileUpload,
  FileUploadClear,
  FileUploadDropzone,
  FileUploadItem,
  FileUploadItemDelete,
  FileUploadItemMetadata,
  FileUploadItemPreview,
  FileUploadItemProgress,
  FileUploadList,
  FileUploadTrigger,
} from "@/components/ui/file-upload"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"

type LineError = {
  line: number
  error: string
}

type UploadSummary = {
  job_id: string
  filename: string
  storage_path: string
  total_lines: number
  parsed_lines: number
  rejected_lines: number
  sample_errors: LineError[]
}

type IngestionJob = {
  id: string
  filename: string
  status: string
  storage_path: string | null
  total_lines: number
  parsed_lines: number
  rejected_lines: number
  created_at: string
  completed_at: string | null
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8080"

function uploadLogFile(
  file: File,
  userId: string,
  options: {
    onProgress: (file: File, progress: number) => void
    onSuccess: (file: File) => void
    onError: (file: File, error: Error) => void
  }
) {
  return new Promise<UploadSummary>((resolve, reject) => {
    const formData = new FormData()
    formData.append("file", file)
    formData.append("user_id", userId)

    const request = new XMLHttpRequest()
    request.open("POST", `${API_BASE_URL}/api/logs/upload`)
    request.responseType = "json"

    request.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) {
        return
      }

      options.onProgress(file, Math.round((event.loaded / event.total) * 100))
    })

    request.addEventListener("load", () => {
      const response =
        request.response && typeof request.response === "object"
          ? (request.response as UploadSummary | { detail?: string })
          : null

      if (request.status >= 200 && request.status < 300 && response) {
        options.onProgress(file, 100)
        options.onSuccess(file)
        resolve(response as UploadSummary)
        return
      }

      const message =
        response &&
        typeof response === "object" &&
        "detail" in response &&
        typeof response.detail === "string"
          ? response.detail
          : "Upload failed"

      const error = new Error(message)
      options.onError(file, error)
      reject(error)
    })

    request.addEventListener("error", () => {
      const error = new Error("Unable to reach backend upload API")
      options.onError(file, error)
      reject(error)
    })

    request.send(formData)
  })
}

export function UploadPanel() {
  const [files, setFiles] = useState<File[]>([])
  const [uploadSummaries, setUploadSummaries] = useState<UploadSummary[]>([])
  const [requestError, setRequestError] = useState<string | null>(null)
  const [latestJob, setLatestJob] = useState<IngestionJob | null>(null)
  const [isLoadingLatestJob, setIsLoadingLatestJob] = useState(true)

  useEffect(() => {
    let ignore = false

    async function loadLatestJob() {
      const supabase = getSupabaseBrowserClient()
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser()

      if (error || !user) {
        if (!ignore) {
          setIsLoadingLatestJob(false)
        }
        return
      }

      const { data, error: jobsError } = await supabase
        .from("ingestion_jobs")
        .select(
          "id, filename, status, storage_path, total_lines, parsed_lines, rejected_lines, created_at, completed_at"
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!ignore) {
        setLatestJob(jobsError ? null : (data as IngestionJob | null))
        setIsLoadingLatestJob(false)
      }
    }

    void loadLatestJob()

    return () => {
      ignore = true
    }
  }, [uploadSummaries])

  async function handleUpload(
    selectedFiles: File[],
    options: {
      onProgress: (file: File, progress: number) => void
      onSuccess: (file: File) => void
      onError: (file: File, error: Error) => void
    }
  ) {
    setRequestError(null)
    const supabase = getSupabaseBrowserClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error || !user) {
      setRequestError("You must be signed in before uploading logs.")
      return
    }

    const nextSummaries: UploadSummary[] = []

    for (const file of selectedFiles) {
      try {
        const summary = await uploadLogFile(file, user.id, options)
        nextSummaries.push(summary)
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Upload failed"
        setRequestError(message)
      }
    }

    if (nextSummaries.length > 0) {
      setUploadSummaries((current) => {
        const existing = new Map(current.map((item) => [item.filename, item]))
        for (const summary of nextSummaries) {
          existing.set(summary.filename, summary)
        }
        return Array.from(existing.values())
      })
      setFiles((current) =>
        current.filter(
          (file) =>
            !nextSummaries.some((summary) => summary.filename === file.name)
        )
      )
    }
  }

  return (
    <div className="space-y-4">
      <Card className="border-border/60 bg-card/70 backdrop-blur">
        <CardHeader>
          <CardTitle>Latest Ingestion Metadata</CardTitle>
          <CardDescription>
            Metadata from the most recent `ingestion_jobs` entry for your account.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
          <div className="rounded-xl border border-border/70 bg-background/50 p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-base font-semibold">Latest ingestion job</p>
                <p className="text-muted-foreground mt-1 text-[11px] uppercase tracking-[0.18em]">
                  Supabase metadata
                </p>
              </div>
              {latestJob ? (
                <div
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                    latestJob.status === "completed"
                      ? "bg-primary/12 text-primary"
                      : latestJob.status === "failed"
                        ? "bg-destructive/12 text-destructive"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {latestJob.status}
                </div>
              ) : null}
            </div>

            {isLoadingLatestJob ? (
              <p className="text-muted-foreground mt-4 text-xs">
                Loading latest ingestion metadata...
              </p>
            ) : latestJob ? (
              <div className="mt-4 space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg border border-border/60 bg-card/60 p-3">
                    <p className="text-muted-foreground text-[11px] uppercase tracking-[0.18em]">
                      File
                    </p>
                    <p className="mt-2 truncate text-sm font-medium">
                      {latestJob.filename}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-card/60 p-3">
                    <p className="text-muted-foreground text-[11px] uppercase tracking-[0.18em]">
                      Job ID
                    </p>
                    <p className="mt-2 break-all text-xs text-muted-foreground">
                      {latestJob.id}
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-lg border border-border/60 bg-card/60 p-3">
                    <p className="text-muted-foreground text-[11px] uppercase tracking-[0.18em]">
                      Parsed
                    </p>
                    <p className="mt-2 text-xl font-semibold">
                      {latestJob.parsed_lines}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-card/60 p-3">
                    <p className="text-muted-foreground text-[11px] uppercase tracking-[0.18em]">
                      Total
                    </p>
                    <p className="mt-2 text-xl font-semibold">
                      {latestJob.total_lines}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-card/60 p-3">
                    <p className="text-muted-foreground text-[11px] uppercase tracking-[0.18em]">
                      Rejected
                    </p>
                    <p className="mt-2 text-xl font-semibold">
                      {latestJob.rejected_lines}
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border border-border/60 bg-card/50 p-3">
                  <p className="text-muted-foreground text-[11px] uppercase tracking-[0.18em]">
                    Storage path
                  </p>
                  <p className="mt-2 break-all text-xs leading-5 text-muted-foreground">
                    {latestJob.storage_path ?? "Pending upload"}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground mt-4 text-xs">
                No ingestion job metadata available yet.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/70 backdrop-blur">
        <CardHeader>
          <CardTitle>Log Intake</CardTitle>
          <CardDescription>
            Drop `.log` or `.txt` files here. Each non-empty line should be one
            JSON event object accepted by the backend parser.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FileUpload
            value={files}
            onValueChange={setFiles}
            onUpload={handleUpload}
            accept=".log,.txt"
            maxFiles={8}
            maxSize={25 * 1024 * 1024}
            multiple
            onFileValidate={(file) => {
              if (file.size > 25 * 1024 * 1024) {
                return "Files must be smaller than 25 MB"
              }

              return null
            }}
            className="space-y-4"
          >
            <FileUploadDropzone className="min-h-64 border-primary/20 bg-background/30">
              <div className="flex max-w-md flex-col items-center gap-3 text-center">
                <div className="flex size-14 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary">
                  <FileUp className="size-6" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    Drag and drop structured log files
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Accepts `.log` and `.txt` up to 25 MB each. Each line must
                    contain one JSON object.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <FileUploadTrigger asChild>
                    <Button size="lg">
                      <Upload />
                      Select files
                    </Button>
                  </FileUploadTrigger>
                  <FileUploadClear asChild>
                    <Button variant="ghost" size="lg">
                      Clear queue
                    </Button>
                  </FileUploadClear>
                </div>
              </div>
            </FileUploadDropzone>

            <FileUploadList>
              {files.map((file) => (
                <FileUploadItem
                  key={`${file.name}-${file.size}-${file.lastModified}`}
                  value={file}
                  className="bg-background/50"
                >
                  <FileUploadItemPreview />
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <FileUploadItemMetadata />
                    <FileUploadItemProgress />
                  </div>
                  <FileUploadItemDelete asChild>
                    <Button variant="ghost" size="icon-sm" aria-label="Remove file">
                      <Trash2 />
                    </Button>
                  </FileUploadItemDelete>
                </FileUploadItem>
              ))}
            </FileUploadList>
          </FileUpload>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/70 backdrop-blur">
        <CardHeader>
          <CardTitle>Ingestion Summary</CardTitle>
          <CardDescription>
            Backend responses from `POST /api/logs/upload` appear here after
            each file finishes uploading.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {requestError ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
              <p className="font-medium text-destructive">Upload error</p>
              <p className="mt-1 text-xs leading-5 text-destructive/80">
                {requestError}
              </p>
            </div>
          ) : null}

          {uploadSummaries.length === 0 ? (
            <div className="rounded-lg border border-primary/15 bg-primary/5 p-4">
              <p className="font-medium">No uploads yet</p>
              <p className="text-muted-foreground mt-1 text-xs leading-5">
                Upload a `.log` or `.txt` file to see parsed line counts and any
                validation failures returned by the backend.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {uploadSummaries.map((summary) => (
                <div
                  key={summary.filename}
                  className="rounded-xl border border-border/70 bg-background/50 p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-base font-semibold">
                        {summary.filename}
                      </p>
                      <p className="text-muted-foreground mt-1 text-[11px] uppercase tracking-[0.18em]">
                        Ingestion result
                      </p>
                    </div>
                    <div
                      className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                        summary.rejected_lines === 0
                          ? "bg-primary/12 text-primary"
                          : "bg-destructive/12 text-destructive"
                      }`}
                    >
                      {summary.rejected_lines === 0
                        ? "Clean upload"
                        : `${summary.rejected_lines} rejected`}
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-border/60 bg-card/60 p-3">
                      <p className="text-muted-foreground text-[11px] uppercase tracking-[0.18em]">
                        Parsed
                      </p>
                      <p className="mt-2 text-2xl font-semibold">
                        {summary.parsed_lines}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border/60 bg-card/60 p-3">
                      <p className="text-muted-foreground text-[11px] uppercase tracking-[0.18em]">
                        Total lines
                      </p>
                      <p className="mt-2 text-2xl font-semibold">
                        {summary.total_lines}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-lg border border-border/60 bg-card/50 p-3">
                    <p className="text-muted-foreground text-[11px] uppercase tracking-[0.18em]">
                      Storage path
                    </p>
                    <p className="mt-2 break-all text-xs leading-5 text-muted-foreground">
                      {summary.storage_path}
                    </p>
                  </div>

                  {summary.sample_errors.length > 0 ? (
                    <div className="mt-4 space-y-1">
                      <p className="text-xs font-medium text-destructive">
                        Sample errors
                      </p>
                      {summary.sample_errors.map((error) => (
                        <p
                          key={`${summary.filename}-${error.line}`}
                          className="text-muted-foreground text-xs leading-5"
                        >
                          Line {error.line}: {error.error}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-4 rounded-lg border border-primary/15 bg-primary/5 p-3">
                      <p className="text-xs font-medium text-primary">
                        No validation errors
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Every line in this file matched the current ingestion
                        schema.
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
