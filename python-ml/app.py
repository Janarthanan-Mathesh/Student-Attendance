from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
from model import predictor_instance

app = FastAPI(
    title="Intelligent Attendance Predictive Forecasting API",
    version="1.0.0",
    description="Microservice providing machine learning attendance trajectory projections and dynamic risk zone classification."
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class SinglePredictionRequest(BaseModel):
    student_id: str = Field(..., example="7376232AD162")
    course_code: str = Field(..., example="CS801")
    total_conducted: int = Field(..., ge=0, example=40)
    total_attended: int = Field(..., ge=0, example=28)
    weeks_elapsed: Optional[int] = Field(default=8, ge=1, le=16)
    recent_velocity: Optional[float] = Field(default=0.0)
    approved_od_hours: Optional[int] = Field(default=0, ge=0)

class BatchPredictionRequest(BaseModel):
    items: List[SinglePredictionRequest]

@app.get("/")
def root():
    return {
        "service": "Antigravity Attendance ML Microservice",
        "status": "online",
        "version": "1.0.0"
    }

@app.get("/health")
def health_check():
    return {"status": "healthy", "model_loaded": True}

@app.post("/predict")
def predict_attendance(req: SinglePredictionRequest):
    try:
        res = predictor_instance.predict(
            total_conducted=req.total_conducted,
            total_attended=req.total_attended,
            weeks_elapsed=req.weeks_elapsed,
            recent_velocity=req.recent_velocity,
            approved_od_hours=req.approved_od_hours
        )
        return {
            "student_id": req.student_id,
            "course_code": req.course_code,
            **res
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/batch-predict")
def batch_predict_attendance(req: BatchPredictionRequest):
    results = []
    for item in req.items:
        res = predictor_instance.predict(
            total_conducted=item.total_conducted,
            total_attended=item.total_attended,
            weeks_elapsed=item.weeks_elapsed,
            recent_velocity=item.recent_velocity,
            approved_od_hours=item.approved_od_hours
        )
        results.append({
            "student_id": item.student_id,
            "course_code": item.course_code,
            **res
        })
    return {"predictions": results}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
