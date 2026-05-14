# Smooth App - Comprehensive Nutrition Data Flow Investigation

## Overview

This document details how the smooth-app processes nutrition data from the Open Food Facts API, including REST endpoints, JSON parsing, data models, attributes system, and knowledge panels.

---

## 1. REST API Endpoint and Fields

### API Version and Configuration

- **API Version**: V3 (ProductQueryVersion.v3)
- **openfoodfacts Package Version**: 3.30.2
- **API Client**: `OpenFoodAPIClient` (from openfoodfacts package)
- **Main API Call**: `OpenFoodAPIClient.getProductV3()`

### API Call Location

**File**: [lib/pages/product/common/product_refresher.dart](lib/pages/product/common/product_refresher.dart#L192)

```dart
final ProductResultV3 result = await OpenFoodAPIClient.getProductV3(
  getBarcodeQueryConfiguration(...),
  uriHelper: uriProductHelper,
  user: ProductQuery.getReadUser(),
);
```

### Query Configuration

**File**: [lib/pages/product/common/product_refresher.dart](lib/pages/product/common/product_refresher.dart#L79)

```dart
ProductQueryConfiguration getBarcodeQueryConfiguration(
  final String barcode,
  final OpenFoodFactsLanguage language, {
  final IngredientsUnwantedParameter? unwantedIngredients,
}) => ProductQueryConfiguration(
  barcode,
  fields: ProductQuery.fields,
  language: language,
  country: ProductQuery.getCountry(),
  version: ProductQuery.productQueryVersion,
  productTypeFilter: ProductTypeFilter.all,
  activateKnowledgePanelsSimplified: true,
  unwantedIngredients: unwantedIngredients,
);
```

### Fields Requested

**File**: [lib/query/product_query.dart](lib/query/product_query.dart#L277)

The app requests 57 fields from the API:

```dart
static List<ProductField> get fields => const <ProductField>[
  ProductField.NAME,
  ProductField.NAME_ALL_LANGUAGES,
  ProductField.BRANDS,
  ProductField.BARCODE,
  ProductField.PRODUCT_TYPE,
  ProductField.NUTRISCORE,
  ProductField.FRONT_IMAGE,
  ProductField.IMAGE_FRONT_URL,
  ProductField.IMAGE_INGREDIENTS_URL,
  ProductField.IMAGE_NUTRITION_URL,
  ProductField.IMAGE_PACKAGING_URL,
  ProductField.IMAGES,
  ProductField.SELECTED_IMAGE,
  ProductField.QUANTITY,
  ProductField.SERVING_SIZE,
  ProductField.STORES,
  ProductField.PACKAGING_QUANTITY,
  ProductField.PACKAGING,
  ProductField.PACKAGINGS,
  ProductField.PACKAGINGS_COMPLETE,
  ProductField.PACKAGING_TAGS,
  ProductField.PACKAGING_TEXT_ALL_LANGUAGES,
  ProductField.NO_NUTRITION_DATA,
  ProductField.NUTRIMENT_DATA_PER,      // ← Nutrition per unit (100g/serving)
  ProductField.NUTRITION_DATA,
  ProductField.NUTRIMENTS,               // ← Individual nutrient values
  ProductField.NUTRIENT_LEVELS,          // ← Nutrient level evaluations
  ProductField.NUTRIMENT_ENERGY_UNIT,
  ProductField.ADDITIVES,
  ProductField.INGREDIENTS_ANALYSIS_TAGS,
  ProductField.INGREDIENTS_TEXT,
  ProductField.INGREDIENTS_TEXT_ALL_LANGUAGES,
  ProductField.LABELS_TAGS,
  ProductField.LABELS_TAGS_IN_LANGUAGES,
  ProductField.COMPARED_TO_CATEGORY,
  ProductField.CATEGORIES_TAGS,
  ProductField.CATEGORIES_TAGS_IN_LANGUAGES,
  ProductField.LANGUAGE,
  ProductField.ATTRIBUTE_GROUPS,         // ← Attributes system
  ProductField.STATES_TAGS,
  ProductField.ECOSCORE_DATA,
  ProductField.ECOSCORE_GRADE,
  ProductField.ECOSCORE_SCORE,
  ProductField.KNOWLEDGE_PANELS,         // ← Knowledge panels (nutritional facts, etc.)
  ProductField.COUNTRIES,
  ProductField.COUNTRIES_TAGS,
  ProductField.COUNTRIES_TAGS_IN_LANGUAGES,
  ProductField.EMB_CODES,
  ProductField.ORIGINS,
  ProductField.WEBSITE,
  ProductField.OBSOLETE,
  ProductField.OWNER_FIELDS,
  ProductField.OWNER,
  ProductField.TRACES,
  ProductField.TRACES_TAGS,
  ProductField.TRACES_TAGS_IN_LANGUAGES,
];
```

#### Key Nutrition-Related Fields:

| Field                | Purpose                                                                           |
| -------------------- | --------------------------------------------------------------------------------- |
| `NUTRIMENT_DATA_PER` | Specifies unit (per 100g, per serving, per container)                             |
| `NUTRIMENTS`         | Map of nutrient values (energy, proteins, fats, carbs, sugars, salt, fiber, etc.) |
| `NUTRIENT_LEVELS`    | Categorization of nutrients (high/medium/low)                                     |
| `NUTRISCORE`         | Nutri-Score grade (A-E)                                                           |
| `ATTRIBUTE_GROUPS`   | Product attributes with scores                                                    |
| `KNOWLEDGE_PANELS`   | Structured nutrition info panels (including nutrition facts table)                |
| `ECOSCORE_*`         | Environmental scoring data                                                        |

### API Endpoint URL Structure

The app uses different endpoints based on configuration:

- **Production**: `https://world.openfoodfacts.org/`
- **Test**: `https://world-test.openfoodfacts.org/`
- **Custom**: Configurable via dev mode preferences

The actual endpoint is constructed by the openfoodfacts package using:

- API version: v3
- Barcode: The product code
- Fields as query parameters
- Language and country parameters

---

## 2. JSON Response Parsing & Data Deserialization

### API Response Structure

**Response Type**: `ProductResultV3` (from openfoodfacts package)

**File**: [lib/pages/product/common/product_refresher.dart](lib/pages/product/common/product_refresher.dart#L192-L210)

```dart
final ProductResultV3 result = await OpenFoodAPIClient.getProductV3(...);
if (result.product != null) {
  // Deserialized Product object
  await DaoProduct(localDatabase).put(
    result.product!,
    language,
    productType: productType
  );
  return FetchedProduct.found(result.product!);
}
```

### openfoodfacts Package Models

**Version**: 3.30.2

**Key Models Used**:

- **Product**: Main product model containing all fields
- **Nutrient**: Individual nutrient data (energy, proteins, fats, etc.)
- **Attribute**: Product attributes (nova, additives, allergens, etc.)
- **Grade**: Enum for grades (A, B, C, D, E)
- **KnowledgePanel**: Structured nutrition information panels
- **KnowledgePanelElement**: Components within panels (text, table, title, image, etc.)
- **TitleElement**: Panel title with grade, icon, evaluation
- **OrderedNutrients**: Server-provided ordered list of nutrients for a product type

### Data Deserialization Process

1. **OpenFoodAPIClient** makes HTTP request with ProductQueryConfiguration
2. API returns JSON response
3. **openfoodfacts package** deserializes JSON into Dart objects
4. **Product** object contains all nested structures
5. App stores **Product** in local SQLite database via **DaoProduct**
6. **LocalDatabase** caches product for offline access

### Key Classes & Deserialization

**File Imports** across codebase show these models from openfoodfacts:

```dart
import 'package:openfoodfacts/openfoodfacts.dart';
```

This provides:

- JSON deserialization via generated `.fromJson()` constructors
- JSON serialization via `.toJson()` methods
- Factory constructors for model creation

---

## 3. Nutrition Data Structure

### Product Nutrition Fields

#### 3.1 Nutriments (Individual Values)

**Field**: `product.nutriments` - Map of nutrient values
**Type**: `Map<String, dynamic>?`

**Common Nutrient Keys**:

- `energy` / `energy-kcal` / `energy-kj` - Energy values
- `proteins` - Protein content
- `fat` - Total fat
- `saturated-fat` / `saturated_fat` - Saturated fat
- `trans-fat` - Trans fat
- `polyunsaturated-fat` - Polyunsaturated fat
- `monounsaturated-fat` - Monounsaturated fat
- `carbohydrates` / `carbs` - Carbohydrate content
- `sugars` - Sugar content
- `fiber` / `dietary-fiber` - Fiber content
- `salt` / `sodium` - Salt/sodium content
- `alcohol` - Alcohol content

**Example Structure**:

```json
{
  "nutriments": {
    "energy": 2050,
    "energy-kcal": 490,
    "proteins": 15,
    "fat": 20,
    "saturated-fat": 8,
    "carbohydrates": 65,
    "sugars": 15,
    "salt": 1.5,
    "fiber": 3
  }
}
```

#### 3.2 Nutrition Data Per Unit

**Field**: `product.nutrimentDataPer` (from `NUTRIMENT_DATA_PER`)
**Type**: `String`
**Values**:

- `"100g"` - Per 100 grams (standard reference)
- `"serving"` - Per serving
- `"container"` - Per entire package/container

**Associated Field**: `product.servingSize` - Size of one serving (e.g., "30g")

#### 3.3 Nutrient Levels

**Field**: `product.nutrientLevels` - Categorization of nutrients
**Type**: `Map<String, String>?`
**Format**: Keys are nutrient names, values are levels
**Possible Values**: `"high"`, `"moderate"`, `"low"`

**Example**:

```json
{
  "nutrient_levels": {
    "fat": "high",
    "saturated-fat": "high",
    "sugars": "high",
    "salt": "moderate"
  }
}
```

#### 3.4 Nutrition Data Field

**Field**: `product.nutritionData`
**Purpose**: Alternative/supplementary nutrition data storage

#### 3.5 No Nutrition Data Flag

**Field**: `product.noNutritionData` - Boolean flag
**Indicates**: Whether product has missing nutrition facts

### Nutrient Ordering

**File**: [lib/pages/product/ordered_nutrients_cache.dart](lib/pages/product/ordered_nutrients_cache.dart)

The app fetches **OrderedNutrients** from server per product type:

```dart
final OrderedNutrients? cache = await OrderedNutrientsCache.getCache(
  context,
  productType,
);
// Returns: cache.orderedNutrients.nutrients - ordered list of nutrients for display
```

This ensures nutrients are displayed in the correct order for different product types (food, beverage, etc.).

---

## 4. Attributes System

### Attribute Definition

**File**: [lib/pages/product/attribute_extensions.dart](lib/pages/product/attribute_extensions.dart)

**Field**: `product.attributeGroups` - List of AttributeGroup objects
**Each AttributeGroup contains**: List of Attribute objects

### Attribute Structure

**Properties** (from openfoodfacts package):

- `id` - Unique identifier (string)
- `name` - Display name
- `title` - Title/heading
- `description` - Full description
- `descriptionShort` - Short description
- `status` - Attribute evaluation status
  - `STATUS_KNOWN` = Data available
  - `STATUS_UNKNOWN` = No data/not applicable
  - `STATUS_INCOMPATIBLE` = Not applicable to product
- `match` - Match score (0-100)
  - Used to calculate evaluation level
  - Computed from consumer preferences
- `iconUrl` - Icon URL for display
- `descriptionShort` - Short description text

### Main Attributes (SCORE_ATTRIBUTE_IDS)

**File**: [lib/helpers/ui_helpers.dart](lib/helpers/ui_helpers.dart#L10)

```dart
const List<String> SCORE_ATTRIBUTE_IDS = <String>[
  Attribute.ATTRIBUTE_NUTRISCORE,  // Nutri-Score grade
  Attribute.ATTRIBUTE_ECOSCORE,    // Eco-Score grade
];
```

### Attribute Examples

Common attributes include:

- `nutriscore` - Nutri-Score (A-E) grade
- `ecoscore` - Eco-Score (A-E) grade
- `nova` - NOVA food processing level (1-4)
- `additives` - Presence of additives
- `allergens_no_*` - Allergen markers (celery, fish, gluten, milk, nuts, etc.)
- `vegan` - Whether product is vegan
- `vegetarian` - Whether product is vegetarian
- `palm_oil` - Contains palm oil
- `salt` - Salt content level
- `sugars` - Sugar content level

### Attribute Evaluation

**File**: [lib/helpers/attributes_card_helper.dart](lib/helpers/attributes_card_helper.dart#L81)

**Evaluation Enum**:

```dart
enum AttributeEvaluation {
  UNKNOWN,    // No data or match score invalid
  VERY_BAD,   // Match: 0-20
  BAD,        // Match: 21-40
  NEUTRAL,    // Match: 41-60
  GOOD,       // Match: 61-80
  VERY_GOOD;  // Match: 81-100
}
```

**Match Score Calculation** (lines 85-104):

```dart
// 0-20: Very Bad
// 21-40: Bad
// 41-60: Neutral
// 61-80: Good
// 81-100: Very Good
// > 100: Unknown

final int matchGrade = (attribute.match! / 20.0).ceil();
```

**Evaluation to Color Mapping** (lines 55-75):

```dart
UNKNOWN    → Grey
VERY_BAD   → Red
BAD        → Orange
NEUTRAL    → Yellow
GOOD       → Light Green
VERY_GOOD  → Dark Green
```

### Attribute Availability Check

**Method**: `isMatchAvailable(Attribute attribute)`

```dart
bool isMatchAvailable(Attribute attribute) {
  return attribute.status == Attribute.STATUS_KNOWN &&
         attribute.match != null;
}
```

---

## 5. Knowledge Panels - Nutrition Information Structure

### Knowledge Panel Architecture

**Field**: `product.knowledgePanels`
**Type**: `KnowledgePanels` object containing `Map<String, KnowledgePanel>`

### Panel ID References

**File**: [lib/pages/product/reorderable_knowledge_panel_page.dart](lib/pages/product/reorderable_knowledge_panel_page.dart)

**Main Panels**:

- `'root'` - Root panel containing all sub-panels
- `'simplified_root'` - Simplified version (when activateKnowledgePanelsSimplified: true)
- `'health_card'` - Nutrition/health information
- `'environment_card'` - Environmental impact
- `'nutrition_facts_table'` - Detailed nutrition facts table
- `'nutrient_level_fat'` - Fat level evaluation
- `'nutrient_level_saturated-fat'` - Saturated fat level
- `'nutrient_level_sugars'` - Sugar level
- `'nutrient_level_salt'` - Salt level

### KnowledgePanel Structure

**Properties**:

- `titleElement` - TitleElement with grade, icon, title
- `panelId` - Unique panel identifier
- `elements` - List of KnowledgePanelElement objects
- `evaluation` - Evaluation object
- `topics` - Related topics
- `halfWidthOnMobile` - Display hint

### KnowledgePanelElement Types

**File**: [lib/knowledge_panel/knowledge_panels_builder.dart](lib/knowledge_panel/knowledge_panels_builder.dart#L250-L290)

**ElementType Enum**:

```dart
case KnowledgePanelElementType.TEXT:
  → KnowledgePanelTextCard

case KnowledgePanelElementType.IMAGE:
  → KnowledgePanelImageCard

case KnowledgePanelElementType.TABLE:
  → KnowledgePanelTableCard  // Nutrition facts table

case KnowledgePanelElementType.PANEL:
  → Nested panel reference

case KnowledgePanelElementType.PANEL_GROUP:
  → Group of multiple panels

case KnowledgePanelElementType.ACTION:
  → Interactive action element
```

### TitleElement with Grades

**Properties**:

- `title` - Panel title string
- `subtitle` - Subtitle text
- `grade` - Grade enum (A, B, C, D, E, UNKNOWN)
- `evaluation` - Evaluation object
- `iconUrl` - Icon URL
- `iconColorFromEvaluation` - Whether to color icon from grade
- `type` - Element type

**File**: [lib/cards/data_cards/score_card.dart](lib/cards/data_cards/score_card.dart#L53)

**Grade to CardEvaluation Mapping**:

```dart
extension GradeExtension on Grade? {
  CardEvaluation getCardEvaluation() {
    switch (this) {
      case Grade.A:
        return CardEvaluation.VERY_GOOD;      // Dark Green
      case Grade.B:
        return CardEvaluation.GOOD;           // Light Green
      case Grade.C:
        return CardEvaluation.NEUTRAL;        // Yellow
      case Grade.D:
        return CardEvaluation.BAD;            // Orange
      case Grade.E:
        return CardEvaluation.VERY_BAD;       // Red
      case null || Grade.UNKNOWN:
        return CardEvaluation.UNKNOWN;        // Grey
    }
  }
}
```

### Nutrition Facts Table Element

**Type**: `KnowledgePanelTableElement`
**File**: [lib/knowledge_panel/knowledge_panels/knowledge_panel_table_card.dart](lib/knowledge_panel/knowledge_panels/knowledge_panel_table_card.dart)

**Properties**:

- `rows` - Table rows
- `columns` - Table column definitions
- Each column can have dropdown variants for different measurement units

**Column Variants**:

- Per 100g
- Per serving
- Per container
- Different units (g, mg, % daily value, etc.)

### Knowledge Panel Builder

**File**: [lib/knowledge_panel/knowledge_panels_builder.dart](lib/knowledge_panel/knowledge_panels_builder.dart)

**Main Methods**:

- `getKnowledgePanel(product, panelId)` - Retrieve panel by ID
- `getRootPanelElements(product)` - Get all root-level panels
- `getChildren(context, panelElement, product)` - Build widget tree from panel
- `getElementWidget()` - Convert element to Flutter widget

**Panel Data Flow**:

```
product.knowledgePanels
  ↓
KnowledgePanelsBuilder.getKnowledgePanel(product, 'health_card')
  ↓
KnowledgePanel with titleElement and elements[]
  ↓
KnowledgePanelsBuilder.getElementWidget() for each element
  ↓
Display as KnowledgePanelTitleCard, KnowledgePanelTableCard, etc.
```

---

## 6. Key Data Models

### Product Model

**Source**: openfoodfacts package
**Primary Storage Location**: [lib/database/dao_product.dart](lib/database/dao_product.dart)

**Key Fields for Nutrition**:

```dart
class Product {
  String? barcode;
  String? productName;
  String? brands;

  // Nutrition data
  Map<String, dynamic>? nutriments;        // Individual nutrient values
  String? nutrimentDataPer;                // "100g", "serving", "container"
  String? servingSize;                     // e.g., "30g"
  Map<String, String>? nutrientLevels;    // "high"/"moderate"/"low"
  String? nutritionData;                   // Alternative nutrition data
  bool? noNutritionData;                   // No nutrition facts available
  String? nutrimentEnergyUnit;             // "kJ" or "kcal"

  // Scoring
  String? nutritionGradeFr;                // Nutri-Score grade
  String? ecoscore;                        // Eco-Score letter
  Map<String, dynamic>? ecoscoreData;     // Eco-Score details

  // Attributes
  List<AttributeGroup>? attributeGroups;  // Attributes with scores

  // Knowledge Panels
  KnowledgePanels? knowledgePanels;       // Structured nutrition info

  // Other fields
  List<String>? categoriesTags;
  List<String>? labelsTags;
  String? ingredientsText;
  List<String>? additivesTags;
  String? productType;

  ProductImage? selectedImage;
  List<ProductImage>? images;
  // ... 50+ other fields
}
```

### Nutrient Model

**Purpose**: Individual nutrient data representation
**Used In**: OrderedNutrients list

**Key Properties**:

- `name` - Nutrient name (e.g., "Proteins")
- `tag` - Tag identifier (e.g., "proteins")
- `value` - Numerical value
- `unit` - Measurement unit (g, mg, %, etc.)

### Attribute Model

**Properties**:

- `id` - String identifier
- `name` - Display name
- `title` - Title
- `description` - Full description
- `descriptionShort` - Short description
- `status` - STATUS_KNOWN, STATUS_UNKNOWN, STATUS_INCOMPATIBLE
- `match` - Match score (0-100+)
- `iconUrl` - Icon URL

**Extension** (file: attribute_extensions.dart):

```dart
extension AttributeExtensions on Attribute {
  Widget? getIcon() { ... }
  Widget getCircledIcon() { ... }
  String? getAttributeIdFromTag() { ... }
}
```

### Grade Enum

**Source**: openfoodfacts package
**Values**:

```dart
enum Grade {
  UNKNOWN,
  A,      // Best (Green)
  B,      // Good (Light Green)
  C,      // Neutral (Yellow)
  D,      // Bad (Orange)
  E;      // Worst (Red)
}
```

### KnowledgePanel Model

**Structure**:

```dart
class KnowledgePanel {
  String? panelId;
  TitleElement? titleElement;
  List<KnowledgePanelElement>? elements;
  Evaluation? evaluation;
  List<String>? topics;
  bool? halfWidthOnMobile;
}
```

### TitleElement Model

**Used in**: KnowledgePanel title sections and ScoreCard

**Properties**:

```dart
class TitleElement {
  String? title;
  String? subtitle;
  Grade? grade;
  String? iconUrl;
  String? sourceUrl;
  bool? iconColorFromEvaluation;
  Evaluation? evaluation;
  String? type;
}
```

### OrderedNutrients Model

**Purpose**: Server-provided nutrient ordering for product type
**File**: [lib/pages/product/ordered_nutrients_cache.dart](lib/pages/product/ordered_nutrients_cache.dart)

**Structure**:

```dart
class OrderedNutrients {
  List<Nutrient> nutrients;
}
```

---

## 7. Data Flow: API to UI

### Complete Data Flow Diagram

```
┌─────────────────────────────────────────┐
│ 1. USER SCANS BARCODE                   │
│    (BarcodeProductQuery.getFetchedProduct)
└─────────────────┬───────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────┐
│ 2. CREATE API REQUEST                   │
│    ProductRefresher.silentFetchAndRefresh
│    - Build ProductQueryConfiguration    │
│    - Set fields: 57 product fields      │
│    - Set language, country              │
│    - Set activateKnowledgePanelsSimplified
└─────────────────┬───────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────┐
│ 3. CALL API                             │
│    OpenFoodAPIClient.getProductV3()     │
│    → HTTP GET to Open Food Facts API    │
│    - Endpoint: /api/v3/product/{barcode}
│    - Query params: fields, lc, cc, etc. │
└─────────────────┬───────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────┐
│ 4. RECEIVE JSON RESPONSE                │
│    ProductResultV3 with Product object  │
│    Contains:                            │
│    - nutriments {}                      │
│    - nutrimentDataPer: "100g"           │
│    - nutrientLevels {}                  │
│    - attributeGroups []                 │
│    - knowledgePanels {}                 │
└─────────────────┬───────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────┐
│ 5. DESERIALIZE JSON TO OBJECTS          │
│    openfoodfacts package:               │
│    - Product.fromJson()                 │
│    - Recursive model deserialization    │
└─────────────────┬───────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────┐
│ 6. STORE IN LOCAL DATABASE              │
│    DaoProduct.put(product, language)    │
│    - SQLite storage                     │
│    - Offline access                     │
│    - Update latest downloaded           │
└─────────────────┬───────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────┐
│ 7. RETURN FETCHED PRODUCT               │
│    FetchedProduct.found(product)        │
│    - Available for UI display           │
└─────────────────┬───────────────────────┘
                  │
                  ↓
         ┌────────┴─────────┐
         │                  │
         ↓                  ↓
    ┌─────────────┐  ┌──────────────┐
    │ DISPLAY UI  │  │ SHOW SCORES  │
    └─────────────┘  └──────────────┘
         │                  │
         ↓                  ↓
    ┌─────────────────────────────────┐
    │ 8a. NUTRITION DISPLAY           │
    │ - KnowledgePanelsBuilder        │
    │ - getElementWidget()            │
    │ - Build panel widgets           │
    │ - Display nutrition facts table │
    │ - Show nutrient levels          │
    └─────────────────────────────────┘
         │
         ↓
    ┌─────────────────────────────────┐
    │ 8b. ATTRIBUTE DISPLAY           │
    │ - Product attributes[]          │
    │ - getAttributeDisplayIcon()     │
    │ - Match score → Evaluation      │
    │ - Color coded display           │
    └─────────────────────────────────┘
         │
         ↓
    ┌─────────────────────────────────┐
    │ 8c. SCORE DISPLAY               │
    │ - Grade enum (A-E)              │
    │ - TitleElement.grade            │
    │ - ScoreCard widget              │
    │ - Color: Green/Yellow/Red       │
    └─────────────────────────────────┘
```

### File Processing Chain

```
BarcodeProductQuery
  ↓
ProductRefresher.silentFetchAndRefresh()
  ├─ ProductQuery.getBarcodeQueryConfiguration()
  ├─ OpenFoodAPIClient.getProductV3()
  └─ DaoProduct.put()
      ↓
      DaoProduct (database/dao_product.dart)
        ↓
        LocalDatabase (SQLite)
          ↓
          Product object stored and retrieved
            ↓
    ┌─────────────────────┬──────────────┬────────────────┐
    │                     │              │                │
    ↓                     ↓              ↓                ↓
Nutrition Display    Attributes     Knowledge       Portion
(nutriments)         Display        Panels          Calculator
    │                 │              │                │
    ↓                 ↓              ↓                ↓
OrderedNutrients  attributes_card  knowledge_panel  ordered_nutrients
Cache             _helper          s_builder        _cache
    │                 │              │                │
    ↓                 ↓              ↓                ↓
Nutrients list   Attribute        Panel widgets    Nutrient
displayed in     Evaluation       with TitleElem   ordering
correct order    enum             and elements
```

---

## 8. Specific Implementation Details

### 8.1 Nutrition Facts Display

**File**: [lib/knowledge_panel/knowledge_panels/knowledge_panel_table_card.dart](lib/knowledge_panel/knowledge_panels/knowledge_panel_table_card.dart)

- Displays nutrition facts in table format
- Rows = Different nutrients (energy, proteins, fats, carbs, sugars, salt, fiber)
- Columns = Different units/measurements (per 100g, per serving, % daily value)
- Column dropdown allows switching between variants
- Color-coded nutrition levels

### 8.2 Nutrition Portion Calculator

**File**: [lib/pages/product/portion_calculator.dart](lib/pages/product/portion_calculator.dart)

- Uses `product.nutriments` map
- Fetches `OrderedNutrientsCache` for nutrient ordering
- Multiplies values by portion factor
- Displays calculated nutrition per custom portion

### 8.3 Attribute Score Calculation

**File**: [lib/helpers/attributes_card_helper.dart](lib/helpers/attributes_card_helper.dart)

```
Attribute.match (0-100)
  ↓
Match ÷ 20 = Integer (0-5)
  ↓
Switch on result:
  0-1: VERY_BAD (Red)
  2:   BAD (Orange)
  3:   NEUTRAL (Yellow)
  4:   GOOD (Light Green)
  5:   VERY_GOOD (Dark Green)
  else: UNKNOWN (Grey)
```

### 8.4 Knowledge Panel Rendering

**File**: [lib/knowledge_panel/knowledge_panels_builder.dart](lib/knowledge_panel/knowledge_panels_builder.dart#L30-L75)

```dart
KnowledgePanelsBuilder.getChildren()
  ├─ Get root panel
  ├─ Add TitleElement (with grade)
  └─ For each element in panel.elements:
      ├─ TEXT → KnowledgePanelTextCard
      ├─ IMAGE → KnowledgePanelImageCard
      ├─ TABLE → KnowledgePanelTableCard
      ├─ PANEL → Nested panel (recursive)
      ├─ PANEL_GROUP → Multiple panels
      └─ ACTION → Interactive element
```

### 8.5 Score Card Display

**File**: [lib/cards/data_cards/score_card.dart](lib/cards/data_cards/score_card.dart)

Two constructors for different use cases:

```dart
// 1. From Knowledge Panel Title
ScoreCard.titleElement(
  titleElement: TitleElement,  // Contains grade A-E
  isClickable: bool,
)

// 2. From Product Attribute
ScoreCard.attribute(
  attribute: Attribute,        // Contains match score
  isClickable: bool,
)
```

---

## 9. Key Constants and Enumerations

### Product Field Constants

**File**: [lib/query/product_query.dart](lib/query/product_query.dart)

57 fields defined in static getter `ProductQuery.fields`

### Attribute Evaluation Levels

**File**: [lib/helpers/attributes_card_helper.dart](lib/helpers/attributes_card_helper.dart#L9)

```dart
enum AttributeEvaluation {
  UNKNOWN,    // match score invalid/missing
  VERY_BAD,   // 0-20
  BAD,        // 21-40
  NEUTRAL,    // 41-60
  GOOD,       // 61-80
  VERY_GOOD;  // 81-100
}
```

### Card Evaluation Colors

**File**: [lib/cards/data_cards/score_card.dart](lib/cards/data_cards/score_card.dart#L9)

```dart
enum CardEvaluation {
  UNKNOWN(backgroundColor: GREY_COLOR, textColor: PRIMARY_GREY_COLOR),
  VERY_BAD(backgroundColor: RED_BACKGROUND_COLOR, textColor: RED_COLOR),
  BAD(backgroundColor: ORANGE_BACKGROUND_COLOR, textColor: LIGHT_ORANGE_COLOR),
  NEUTRAL(backgroundColor: YELLOW_BACKGROUND_COLOR, textColor: DARK_YELLOW_COLOR),
  GOOD(backgroundColor: LIGHT_GREEN_BACKGROUND_COLOR, textColor: LIGHT_GREEN_COLOR),
  VERY_GOOD(backgroundColor: DARK_GREEN_BACKGROUND_COLOR, textColor: DARK_GREEN_COLOR);
}
```

### Knowledge Panel Element Types

**Source**: openfoodfacts package

```
TEXT, IMAGE, TABLE, PANEL, PANEL_GROUP, ACTION, WORLD_MAP, SQUARE
```

### Grade Enum

```
UNKNOWN, A, B, C, D, E
```

---

## 10. Summary Architecture

### Three Main Data Pathways

#### Pathway 1: Raw Nutriments

```
product.nutriments {energy, proteins, fats, ...}
  ↓
OrderedNutrientsCache (ensures correct order per product type)
  ↓
KnowledgePanelTableCard (displays in table)
  ↓
User sees nutrition facts with values per 100g/serving
```

#### Pathway 2: Attribute Scores

```
product.attributeGroups[].attributes[]
  ├─ Attribute.match (0-100 score)
  ├─ Attribute.status (KNOWN/UNKNOWN)
  │
  ↓ (via attributes_card_helper)

AttributeEvaluation (VERY_BAD/BAD/NEUTRAL/GOOD/VERY_GOOD)
  ↓
CardEvaluation (Color + Icon)
  ↓
ScoreCard.attribute() widget
  ↓
User sees icon with color based on match score
```

#### Pathway 3: Knowledge Panels

```
product.knowledgePanels.panelIdToPanelMap
  ├─ 'health_card' (nutrition)
  ├─ 'environment_card' (eco-impact)
  └─ 'nutrition_facts_table' (detailed table)
  │
  ↓ (contains)

KnowledgePanel
  ├─ titleElement (with Grade A-E)
  └─ elements[] (text, image, table, etc.)
  │
  ↓ (via KnowledgePanelsBuilder)

KnowledgePanelTitleCard (displays grade with color)
KnowledgePanelTableCard (displays nutrition table)
KnowledgePanelTextCard (displays explanation text)
  │
  ↓
User sees structured, labeled nutrition information
```

---

## 11. File Index - All Key Files

### Query & API

- [lib/query/product_query.dart](lib/query/product_query.dart) - API fields definition
- [lib/pages/product/common/product_refresher.dart](lib/pages/product/common/product_refresher.dart) - API call implementation

### Data Models & Storage

- [lib/database/dao_product.dart](lib/database/dao_product.dart) - Product storage
- [lib/data_models/fetched_product.dart](lib/data_models/fetched_product.dart) - Fetch result wrapper
- [lib/pages/product/ordered_nutrients_cache.dart](lib/pages/product/ordered_nutrients_cache.dart) - Nutrient ordering

### Nutrition Display

- [lib/knowledge_panel/knowledge_panels_builder.dart](lib/knowledge_panel/knowledge_panels_builder.dart) - Panel rendering engine
- [lib/knowledge_panel/knowledge_panels/knowledge_panel_table_card.dart](lib/knowledge_panel/knowledge_panels/knowledge_panel_table_card.dart) - Nutrition table
- [lib/knowledge_panel/knowledge_panels/knowledge_panel_title_card.dart](lib/knowledge_panel/knowledge_panels/knowledge_panel_title_card.dart) - Panel titles with grades
- [lib/pages/product/portion_calculator.dart](lib/pages/product/portion_calculator.dart) - Nutrition calculation

### Attributes System

- [lib/pages/product/attribute_extensions.dart](lib/pages/product/attribute_extensions.dart) - Attribute extensions
- [lib/helpers/attributes_card_helper.dart](lib/helpers/attributes_card_helper.dart) - Attribute evaluation & display
- [lib/helpers/ui_helpers.dart](lib/helpers/ui_helpers.dart) - Score attribute IDs constant

### Score Display

- [lib/cards/data_cards/score_card.dart](lib/cards/data_cards/score_card.dart) - Score card widget
- [lib/helpers/score_card_helper.dart](lib/helpers/score_card_helper.dart) - Grade to evaluation conversion

### Supporting UI

- [lib/pages/product/add_nutrition_button.dart](lib/pages/product/add_nutrition_button.dart) - Add nutrition facts UI
- [lib/pages/product/product_incomplete_card.dart](lib/pages/product/product_incomplete_card.dart) - Missing nutrition indicator

---

## 12. Development Notes

### Testing Nutrition Display

To verify nutrition data flow:

1. Scan a product with complete nutrition facts (barcode scan)
2. Check `product.nutriments` in local database
3. Verify `knowledgePanels['nutrition_facts_table']` contains table element
4. Verify `knowledgePanels['health_card']` contains health information with grade

### Debugging Tips

- **Product fields**: Check what fields are being requested in ProductQuery.fields
- **Knowledge panels**: product.knowledgePanels.panelIdToPanelMap.keys shows available panels
- **Attributes**: product.attributeGroups[].attributes shows all attributes
- **Nutrient ordering**: OrderedNutrientsCache.\_getKey() builds cache key

### Common Modification Points

1. **Add new nutrition field**: Add to ProductQuery.fields
2. **Change nutrient display order**: Modify OrderedNutrients server response handling
3. **Add new attribute type**: Update attribute_extensions.dart icon mapping
4. **Change score colors**: Update CardEvaluation enum

---

## 13. API Example

### Sample API Call

```
GET /api/v3/product/{barcode}
  ?fields=nutrition_grade_fr,nutriments,nutrient_levels,attribute_groups,knowledge_panels,ecoscore_grade,...
  &lc=en
  &cc=US
```

### Sample JSON Response (simplified)

```json
{
  "code": "8250161000000",
  "product_name": "Example Product",
  "brands": "Brand Name",
  "nutriments": {
    "energy": 2050,
    "energy-kcal": 490,
    "proteins": 15,
    "fat": 20,
    "saturated-fat": 8,
    "carbohydrates": 65,
    "sugars": 15,
    "salt": 1.5,
    "fiber": 3
  },
  "nutrition_data_per": "100g",
  "serving_size": "30g",
  "nutrient_levels": {
    "fat": "high",
    "saturated-fat": "high",
    "sugars": "high",
    "salt": "moderate"
  },
  "nutrition_grade_fr": "D",
  "ecoscore_grade": "B",
  "attribute_groups": [
    {
      "attributes": [
        {
          "id": "nutriscore",
          "name": "Nutri-Score",
          "status": "known",
          "match": 45,
          "grade": "D"
        },
        {
          "id": "nova",
          "name": "NOVA",
          "status": "known",
          "match": 65,
          "description": "Ultra-processed food"
        }
      ]
    }
  ],
  "knowledge_panels": {
    "panel_id_to_panel_map": {
      "health_card": {
        "panel_id": "health_card",
        "title_element": {
          "title": "Nutri-Score",
          "grade": "D",
          "icon_url": "https://..."
        },
        "elements": [
          {
            "element_type": "table",
            "table_element": {
              "rows": [...],
              "columns": [...]
            }
          }
        ]
      },
      "nutrition_facts_table": {
        ...detailed nutrition table...
      }
    }
  }
}
```

---

## Conclusion

The smooth-app implements a sophisticated multi-layered approach to nutrition data:

1. **API Integration**: Uses openfoodfacts package with 57 carefully selected fields
2. **Data Parsing**: Automatic JSON deserialization into typed Dart models
3. **Local Storage**: SQLite caching for offline access via queries
4. **Nutrition Display**: Three main pathways (raw nutriments, attributes, knowledge panels)
5. **Attributes System**: Match score based evaluation (0-100) mapped to visual indicators
6. **Knowledge Panels**: Structured, server-provided UI components for complex data
7. **Scoring**: Grade enum (A-E) with color-coded visual representation

The architecture separates concerns effectively:

- API/Query layer handles data retrieval
- DAO layer handles persistence
- Model extensions provide computed properties
- Helper classes manage evaluation/transformation
- Builder classes orchestrate UI rendering
- Widget classes display final result

All components work together to provide users with comprehensive, accurately displayed nutrition information.
