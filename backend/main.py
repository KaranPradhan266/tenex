from fastapi import FastAPI


app = FastAPI(title="tenex-backend")


@app.get("/api/hello")
async def hello() -> dict[str, str]:
    return {"message": "Hello from Python backend"}
