import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression

class AttendancePredictor:
    def __init__(self):
        # Fit models on realistic synthetic historical trajectory dataset
        np.random.seed(42)
        n_samples = 500
        
        # Features: [current_pct, weeks_elapsed, recent_velocity, approved_od_hours, total_course_conducted]
        X = []
        y = []
        
        for _ in range(n_samples):
            weeks = np.random.randint(3, 14)
            conducted = weeks * 4 # 4 hours per week average
            attended = np.random.randint(int(conducted * 0.4), conducted + 1)
            pct = (attended / conducted) * 100
            velocity = np.random.uniform(-5.0, 5.0) # trend slope
            od_hours = np.random.choice([0, 0, 0, 2, 4, 6])
            
            # Target final pct at week 15 (60 total hours)
            remaining_conducted = (15 - weeks) * 4
            future_attend_rate = np.clip((pct / 100.0) + (velocity * 0.02), 0.3, 1.0)
            future_attended = remaining_conducted * future_attend_rate
            
            final_attended = attended + future_attended + od_hours
            final_conducted = 60
            final_pct = np.clip((final_attended / final_conducted) * 100, 0.0, 100.0)
            
            X.append([pct, weeks, velocity, od_hours, conducted])
            y.append(final_pct)
            
        X = np.array(X)
        y = np.array(y)
        
        self.rf_model = RandomForestRegressor(n_estimators=50, random_state=42)
        self.rf_model.fit(X, y)
        
        self.lr_model = LinearRegression()
        self.lr_model.fit(X, y)

    def predict(self, total_conducted: int, total_attended: int, weeks_elapsed: int = 8, recent_velocity: float = 0.0, approved_od_hours: int = 0, total_course_hours: int = 60):
        if total_conducted <= 0:
            current_pct = 100.0
        else:
            current_pct = (total_attended / total_conducted) * 100.0
            
        features = np.array([[current_pct, weeks_elapsed, recent_velocity, approved_od_hours, total_conducted]])
        
        rf_pred = self.rf_model.predict(features)[0]
        lr_pred = self.lr_model.predict(features)[0]
        
        # Ensemble prediction (60% RF, 40% Linear)
        projected_pct = float(round(0.6 * rf_pred + 0.4 * lr_pred, 2))
        projected_pct = min(100.0, max(0.0, projected_pct))
        
        # Calculate classes required for 75% threshold
        # Formula: (total_attended + X) / (total_conducted + X) >= 0.75
        # X * 0.25 >= 0.75 * total_conducted - total_attended
        # X >= (0.75 * total_conducted - total_attended) / 0.25
        needed_75 = 0
        if current_pct < 75.0:
            raw_needed_75 = (0.75 * total_conducted - total_attended) / 0.25
            needed_75 = int(np.ceil(max(0, raw_needed_75)))
            
        needed_80 = 0
        if current_pct < 80.0:
            raw_needed_80 = (0.80 * total_conducted - total_attended) / 0.20
            needed_80 = int(np.ceil(max(0, raw_needed_80)))
            
        # Determine dynamic risk zone
        if projected_pct >= 80.0:
            risk_zone = "GREEN"
            risk_label = "Green Zone - On Track"
        elif projected_pct >= 75.0:
            risk_zone = "AMBER"
            risk_label = "Amber Zone - Early Warning Nudge"
        elif projected_pct >= 65.0:
            risk_zone = "RED"
            risk_label = "Red Zone - Formal Deficiency Notice"
        else:
            risk_zone = "CRITICAL"
            risk_label = "Critical Zone - Detention Trigger & Mentor Intervention"
            
        confidence = float(round(0.88 + (weeks_elapsed / 15.0) * 0.10, 2))
        
        return {
            "current_percentage": round(current_pct, 2),
            "projected_percentage": projected_pct,
            "classes_required_for_75": needed_75,
            "classes_required_for_80": needed_80,
            "risk_zone": risk_zone,
            "risk_label": risk_label,
            "confidence_score": confidence
        }

predictor_instance = AttendancePredictor()
