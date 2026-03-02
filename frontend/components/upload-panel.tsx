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

async function simulateUpload(
  files: File[],
  options: {
    onProgress: (file: File, progress: number) => void
    onSuccess: (file: File) => void
    onError: (file: File, error: Error) => void
  }
) {
  await Promise.all(
    files.map(
      (file) =>
        new Promise<void>((resolve) => {
          let progress = 0
          const intervalId = window.setInterval(() => {
            progress += 20
            options.onProgress(file, progress)

            if (progress >= 100) {
              window.clearInterval(intervalId)
              options.onSuccess(file)
              resolve()
            }
          }, 160)
        })
    )
  )
}

export function UploadPanel() {
  const [files, setFiles] = useState<File[]>([])

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.8fr)]">
      <Card className="border-border/60 bg-card/70 backdrop-blur">
        <CardHeader>
          <CardTitle>Log Intake</CardTitle>
          <CardDescription>
            Drop log bundles here or browse locally. Upload progress is mocked
            for now and will be replaced by the backend ingestion flow.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FileUpload
            value={files}
            onValueChange={setFiles}
            onUpload={simulateUpload}
            accept=".log,.txt,.json,.ndjson,.csv,.gz"
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
                    Drag and drop logs, archives, or JSON batches
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Accepts `.log`, `.txt`, `.json`, `.ndjson`, `.csv`, and
                    `.gz` up to 25 MB each.
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
          <CardTitle>Upload Notes</CardTitle>
          <CardDescription>
            This is the frontend intake surface only. The upload action is
            currently simulated so the list and progress UI can be reviewed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="rounded-lg border border-primary/15 bg-primary/5 p-4">
            <p className="font-medium">Planned backend handoff</p>
            <p className="text-muted-foreground mt-1 text-xs leading-5">
              When the Python backend is ready, this dropzone can post directly
              to an ingestion endpoint and stream real processing states back
              into the list.
            </p>
          </div>
          <div className="space-y-2">
            <p className="font-medium">Expected payloads</p>
            <ul className="text-muted-foreground space-y-1 text-xs leading-5">
              <li>HTTP access logs</li>
              <li>JSON or NDJSON event exports</li>
              <li>Compressed log batches</li>
              <li>Security tooling output</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
