"use client"

import { FileUp, Trash2, Upload } from "lucide-react"
import { useState } from "react"

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

type LineError = {
  line: number
  error: string
}

type UploadSummary = {
  filename: string
  total_lines: number
  parsed_lines: number
  rejected_lines: number
  sample_errors: LineError[]
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8080"

function uploadLogFile(
  file: File,
  options: {
    onProgress: (file: File, progress: number) => void
    onSuccess: (file: File) => void
    onError: (file: File, error: Error) => void
  }
) {
  return new Promise<UploadSummary>((resolve, reject) => {
    const formData = new FormData()
    formData.append("file", file)

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

  async function handleUpload(
    selectedFiles: File[],
    options: {
      onProgress: (file: File, progress: number) => void
      onSuccess: (file: File) => void
      onError: (file: File, error: Error) => void
    }
  ) {
    setRequestError(null)

    const nextSummaries: UploadSummary[] = []

    for (const file of selectedFiles) {
      try {
        const summary = await uploadLogFile(file, options)
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
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.8fr)]">
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
                  className="rounded-lg border border-border/70 bg-background/40 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{summary.filename}</p>
                      <p className="text-muted-foreground mt-1 text-xs">
                        {summary.parsed_lines} parsed / {summary.total_lines}{" "}
                        total lines
                      </p>
                    </div>
                    <div className="text-right text-xs">
                      <p className="text-primary">
                        {summary.rejected_lines} rejected
                      </p>
                    </div>
                  </div>

                  {summary.sample_errors.length > 0 ? (
                    <div className="mt-3 space-y-1">
                      <p className="text-xs font-medium">Sample errors</p>
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
                    <p className="mt-3 text-xs text-muted-foreground">
                      No validation errors returned.
                    </p>
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
