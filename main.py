

from fastapi import FastAPI
import pandas as pd
from pydantic import BaseModel, Field
import joblib
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

# Load model
model = joblib.load("Model_Pipeline.pkl")

# Input validation
class Features(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    price: float = Field(..., gt=0)
    minimum_nights: int = Field(..., ge=1, le=365)
    number_of_reviews: int = Field(..., ge=0)
    reviews_per_month: float = Field(..., ge=0)
    calculated_host_listings_count: int = Field(..., ge=0)
    availability_365: int = Field(..., ge=0, le=365)
    neighbourhood_group: str
    neighbourhood: str

@app.get("/")
def home():
    return {"message": "Hello Guyss"}

@app.post("/predict")
def predict(features: Features):

    # Convert input into DataFrame
    data = pd.DataFrame([features.model_dump()])

    # Prediction
    prediction = model.predict(data)

    # Probability
    probability = model.predict_proba(data)

    return {
        "Predicted_room_type": str(prediction[0]),
        "Probability": probability.tolist()[0]
    }


    

