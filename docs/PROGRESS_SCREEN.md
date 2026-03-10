
# User Metrics Charts Screen — Feature Overview

Dashboard for tracking fitness metrics, nutrition, workouts, and body measurements with multiple visualizations and analytics.

---

## Chart types displayed

### 1. Fat percentage line chart
- Shows body fat percentage over time
- Requires at least 2 data points
- X-axis: dates; Y-axis: fat percentage (%)
- Adjusts scale to fit data range

### 2. Weight line chart
- Shows body weight over time
- Includes summary insights (see Calculations)
- Requires at least 2 data points
- Supports metric (kg) and imperial (lbs)

### 3. FFMI (Fat-Free Mass Index) line chart
- Shows FFMI over time
- Requires height, weight, and fat percentage
- Not shown if height is missing

### 4. Nutrition detailed chart (multiple views)
- Combined view: Weight and calories on one chart (bars for calories, line for weight)
- Stacked bars: Daily calories by macros (carbs, fats, proteins, fibers)
- Calories only: Total daily calories as bars
- Macro-specific views: Individual macros vs total calories (carbs, proteins, fats, or fibers)
- Pie chart: Average daily macro distribution
- Users can switch between views

### 5. Sets per muscle group bar chart
- Shows total sets per muscle group for the selected period
- Only shown in daily view (not weekly averages)
- Includes share image option

### 6. Recent workouts line chart
- Shows workout volume over time
- Volume = sets × reps × weight (includes bodyweight exercises)
- Includes share image option

### 7. Body measurements line charts
- One chart per measurement type (e.g., biceps, chest, waist)
- Created automatically based on available measurements

---

## Filtering options

### 1. Date range selector
- Preset ranges (e.g., last 30 days)
- Default: 30 days
- Loads data from the selected number of days ago to today

### 2. Custom date range
- Start date and end date pickers
- When both are set, shows data only for that range
- Overrides preset date range

### 3. Weekly averages toggle
- Switches between daily and weekly views
- Weekly view:
    - Aggregates daily data into weekly averages
    - Shows date ranges (e.g., "Jan 1 - Jan 7")
    - Hides sets per muscle group chart
- Daily view:
    - Shows individual days
    - Shows all charts including sets per muscle group

---

## Calculations and aggregations

### 1. Weekly averages

#### For body metrics (weight, fat percentage, FFMI)
- Groups data into 7-day windows
- Averages valid data points per week
- Handles partial weeks at the end
- Labels show date ranges (e.g., "Jan 1 - Jan 7")

#### For nutrition
- Groups nutrition into 7-day chunks
- Sums macros and calories per week
- Averages macros, excluding days with zero values
- Converts back to calories for display

#### For workouts
- Aggregates workout volumes by week

### 2. Nutrition data preparation

#### Macro calorie conversion
- Converts grams to calories:
    - Carbs: 4 kcal per gram
    - Fats: 9 kcal per gram
    - Proteins: 4 kcal per gram
    - Fibers: 2 kcal per gram

#### Calorie discrepancy handling
- If total calories ≠ sum of macro calories, distributes the difference proportionally based on macro contribution

### 3. TDEE (Total Daily Energy Expenditure) calculation
- Estimates daily calorie burn
- Uses:
    - Total calories consumed in the period
    - Number of days
    - Initial and final weight
    - Initial and final fat percentage (if enabled)
- Shown in nutrition insights

### 4. FFMI (Fat-Free Mass Index) calculation
- Formula: FFMI = (Weight × (1 - Fat Percentage/100)) / Height²
- Also calculates normalized FFMI (adjusted for height)
- Shown in nutrition insights and as a line chart

### 5. Metrics averages and trends
- Only calculated if there are more than 7 data points
- Method:
    - Groups metrics by week
    - Computes weekly averages for weight and fat percentage
    - Calculates week-over-week changes
    - Computes overall averages:
        - Average weight across all weeks
        - Average weekly weight change
        - Average fat percentage
        - Average weekly fat percentage change
- Used in weight chart insights

### 6. Workout volume calculation
- Total volume per workout = sets × reps × weight
- Includes bodyweight exercises
- Shown in Recent Workouts chart

### 7. Sets per muscle group
- Aggregates sets by muscle group for the selected period
- Shown as a bar chart

### 8. Nutrition and weight aggregation
- Matches nutrition and weight data by date
- In weekly view, further aggregates into weekly chunks
- Used for combined weight + calories chart

### 9. Period statistics
- Calculates:
    - Total calories consumed
    - Number of days with data
    - Initial and final weight
    - Initial and final fat percentage
- Used for TDEE calculation

### 10. Average nutrition distribution (pie chart)
- Sums all macros across all days
- Divides by number of days for daily averages
- Converts to grams/ounces
- Shows average daily macro distribution

### 11. Chart scale calculations
- Weight: Min × 0.95 to Max × 1.05
- Fat percentage: Min × 0.95 to Max × 1.05
- Calories: 0 to Max × 1.2
- Workout volume: Min × 0.5 to Max × 1.2
- FFMI: Min × 0.95 to Max × 1.05

---

## Additional features

### 1. Health Connect integration
- Sync button to import health data from Health Connect
- Syncs data for the selected date range

### 2. AI insights
- Generates nutrition and progression insights
- Creates a chat message with insights
- Only available if AI is enabled

### 3. Quick actions menu
- Get Progression Insights (if AI enabled)
- Manage Metrics
- Manage Nutrition
- List User Measurements
- Sync Health Connect

### 4. Unit system support
- Metric: kilograms and grams
- Imperial: pounds and ounces
- Values are converted based on user preference

### 5. Loading states
- Shows loading indicator while data loads
- Triggers on screen focus, date range changes, and Health Connect sync

### 6. Data reloading
- Auto-reloads when the screen gains focus
- Reloads when date ranges change

### 7. Eating phase context
- Detects bulking, cutting, or maintenance
- Provides phase-specific insights:
    - Bulking: Encourages eating more if weight isn’t increasing
    - Cutting: Encourages eating less if weight isn’t decreasing
- Affects ideal weight change rate messages

### 8. Weight trend analysis
- Determines if weight is trending up or down
- Shows "Your weight is trending upwards/downwards"
- Provides eating phase-specific recommendations

### 9. Muscle/fat change analysis
- Calculates lean body mass (LBM) = Weight × (1 - Fat Percentage/100)
- Calculates fat mass = Weight × (Fat Percentage/100)
- Compares start vs end to determine muscle/fat changes
- Messages include:
    - "You have gained muscle and lost fat"
    - "You have gained muscle and gained fat"
    - "You have lost muscle and lost fat"
    - "You have lost muscle and gained fat"

### 10. Body fat examples
- Shows total weight at different body fat percentages (20%, 15%, 10%, 5%)
- Formula: Total Weight = Lean Body Mass / (1 - Target Fat Percentage/100)
- Helps visualize goal weights

---

## Data sources

1. Body metrics: Weight and fat percentage entries
2. Nutrition: Daily food intake (calories and macros)
3. Workouts: Exercise sessions with volume
4. Body measurements: Custom measurements (e.g., biceps, chest, waist)
5. Sets data: Sets per muscle group
6. User profile: Height, eating phase, unit preferences

---

## Conditional display logic

- Charts require at least 2 data points
- Sets chart only shows in daily view
- FFMI chart only shows if height is available
- Nutrition chart offers multiple views
- Measurement charts are created based on available measurement types

---

## Summary

This screen aggregates fitness, nutrition, and body measurement data into a unified dashboard. It provides:
- Multiple visualization types (line, bar, stacked bar, pie, combined charts)
- Flexible date filtering (preset ranges or custom dates)
- Weekly aggregation option
- Advanced calculations (TDEE, FFMI, trends, muscle/fat changes)
- Contextual insights based on eating phase
- Integration with Health Connect
- AI-powered insights (optional)
- Support for metric and imperial units

Designed for tracking progress, identifying trends, and making data-driven decisions about nutrition and training.