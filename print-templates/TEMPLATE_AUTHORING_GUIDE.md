# Template Authoring Guide

This guide covers everything an implementer needs to create, configure, and customise clinical document templates for the Bahmni Template Service.

---

## 1. Overview

Each clinical document is a template folder containing up to four files:

| File | Required | Purpose |
|---|---|---|
| `template.html` | Yes | Nunjucks HTML template — what gets rendered and printed |
| `data-config.json` | Recommended | Declares which OpenMRS APIs to fetch (sources only) |
| `compute.js` | Optional | Extracts and transforms data from resolved sources; fields returned here become `{{ computed.* }}` in the template |
| `styles.css` | Optional | Extra CSS that is inlined into the rendered HTML |

**Pattern:**
- `data-config.json` declares *what* to fetch (FHIR / REST endpoints).
- `compute.js` decides *what to do with it* — extract fields, apply logic, validate inputs.
- `template.html` only renders — no data logic.

The service renders a template in this order:

```
Request (templateId + context + data)
  → fetch data-config.json sources  (FHIR / REST calls in parallel)
  → run compute.js  (receives resolved sources + request data, returns fields)
  → render template.html  (Nunjucks — uses {{ computed.* }}, {{ data.* }})
  → inline styles.css  (if present)
  → return HTML
```

Template file edits are picked up immediately on the next request — no service restart needed.

---

## 2. Folder structure

```
print-templates/
├── templates.json              ← central registry of all templates
├── _i18n/
│   ├── en.json                 ← English translations
│   └── fr.json                 ← French translations (add more as needed)
├── _base/
│   ├── portrait.html           ← base layout for portrait pages
│   └── landscape.html          ← base layout for landscape pages
├── registration-card/
│   ├── template.html
│   ├── data-config.json
│   └── compute.js
└── prescriptions/
    ├── template.html
    ├── data-config.json
    ├── compute.js
    └── styles.css
```

---

## 3. templates.json — template registry

**Location:** `print-templates/templates.json`

```json
{
  "templates": [
    {
      "id": "REG_CARD_V1",
      "name": "Registration Card",
      "folder": "registration-card"
    },
    {
      "id": "PRESCRIPTION_V1",
      "name": "Prescription",
      "folder": "prescriptions"
    }
  ]
}
```

| Field | Required | Description |
|---|---|---|
| `id` | Yes | Unique identifier — used in the render API call (`templateId`) |
| `name` | Yes | Human-readable name (returned by the list API) |
| `folder` | Yes | Subfolder name under `print-templates/` |

---

## 4. data-config.json — declaring data sources

**Location:** `print-templates/<folder>/data-config.json`

`data-config.json` contains only a `sources` block. It declares which OpenMRS endpoints to call. The raw responses are passed to `compute.js` via `resolved`.

```json
{
  "sources": {
    "<sourceName>": {
      "api": "fhir" | "rest",
      "resource": "<path with {{contextVar}} placeholders>",
      "params": { "<key>": "<value with {{contextVar}} placeholders>" }
    }
  }
}
```

`{{contextVar}}` placeholders are substituted from the render request `context` (e.g. `{{patientUuid}}`). A missing variable causes a 400 error.

**URL construction:**

| `api` | How the URL is built |
|---|---|
| `fhir` | `<OPENMRS_URL>/openmrs/ws/fhir2/R4/<resource>?<params>` — `resource` is just the FHIR resource name, e.g. `Patient` |
| `rest` | `<OPENMRS_URL><resource>?<params>` — `resource` must be the **full path from the domain root**, e.g. `/openmrs/ws/rest/v1/patientprofile/{{patientUuid}}` |

**Example:**
```json
{
  "sources": {
    "patient": {
      "api": "fhir",
      "resource": "Patient",
      "params": { "_id": "{{patientUuid}}" }
    },
    "relatives": {
      "api": "fhir",
      "resource": "RelatedPerson",
      "params": { "patient": "{{patientUuid}}" }
    },
    "patientProfile": {
      "api": "rest",
      "resource": "/openmrs/ws/rest/v1/patientprofile/{{patientUuid}}",
      "params": { "v": "full" }
    },
    "medicationRequests": {
      "api": "fhir",
      "resource": "MedicationRequest",
      "params": {
        "patient": "{{patientUuid}}",
        "_include": "MedicationRequest:encounter",
        "_sort": "-_lastUpdated",
        "_count": "100"
      }
    }
  }
}
```

**Error behaviour:**

| HTTP status | Behaviour |
|---|---|
| 200 | Returns response data |
| 400 | Returns empty Bundle `{ resourceType: 'Bundle', entry: [] }` — does not throw |
| 401 | Throws — service returns a 401 session-expired response |
| 404 | Throws — service returns a 404 not-found response |
| Network timeout | Throws — service returns a 502 response |

---

## 5. compute.js — data extraction and transformation

**Location:** `print-templates/<folder>/compute.js`

`compute.js` receives the raw API responses via `resolved` and any caller-supplied data via `data`. It returns a plain object whose keys are available in the template as `{{ computed.<key> }}`.

### Contract

```js
module.exports = {
  compute: async function ({ context, resolved, data, ValidationError }) {
    // validate required context
    if (!context?.patientUuid) throw new ValidationError('patientUuid is required');

    // extract from resolved sources
    const patient = resolved?.patient?.entry?.[0]?.resource;

    // use caller-supplied data if present
    const printedBy = data?.printedBy ?? '';

    return {
      patientName: patient?.name?.[0]?.text ?? '',
      printedBy,
      // ...
    };
  },
};
```

### Parameters

| Parameter | Type | Description |
|---|---|---|
| `context` | `object` | UUIDs from the render request (`patientUuid`, `visitUuid`, etc.) |
| `resolved` | `object` | Raw API responses keyed by source name from `data-config.json` |
| `data` | `object` | Free-form JSON object passed in the render request `data` field |
| `ValidationError` | `class` | Throw this to return a 400 error to the caller |

- FHIR sources return Bundles — resources are inside `entry[].resource`.
- REST sources return the response body directly.
- `resolved` is `undefined` when there is no `data-config.json`.
- `data` is `undefined` when not supplied in the request.
- Always use optional chaining (`?.`) — bundles can be empty.
- **Never make raw HTTP calls or hardcode credentials.** All fetching belongs in `data-config.json`.

### context — available keys

| Key | When present |
|---|---|
| `patientUuid` | Always |
| `visitUuid` | Print triggered from visit context |
| `encounterUuid` | Print triggered from encounter context |

### Return value

Must be a plain object. Returning `null`, `undefined`, or an array skips the result silently.

---

## 6. template.html — rendering

**Location:** `print-templates/<folder>/template.html`

Templates use Nunjucks — JavaScript's equivalent of Jinja2.

### Template variables

| Variable | Description |
|---|---|
| `{{ computed.<key> }}` | Fields returned from `compute.js` |
| `{{ data.<key> }}` | Free-form data passed in the render request `data` field |
| `{{ <sourceName> }}` | Raw API response object from `data-config.json` sources — available directly, no `compute.js` needed |
| `{{ locale }}` | BCP 47 locale tag, e.g. `"en"`, `"fr"` |
| `{{ now }}` | Date object at render time |

### Using source objects directly in templates

Every source declared in `data-config.json` is available as a top-level variable in the template under its source name. You can navigate the raw response directly without going through `compute.js`.

Given this `data-config.json`:
```json
{
  "sources": {
    "patient": { "api": "fhir", "resource": "Patient", "params": { "_id": "{{patientUuid}}" } }
  }
}
```

The full FHIR Bundle is available as `{{ patient }}` in the template:

```html
{# access nested fields directly #}
<p>{{ patient.entry[0].resource.name[0].text }}</p>
<p>{{ patient.entry[0].resource.birthDate }}</p>
<p>{{ patient.entry[0].resource.gender }}</p>

{# loop over bundle entries #}
{% for entry in patient.entry %}
  <p>{{ entry.resource.name[0].text }}</p>
{% endfor %}

{# use fhirpathEvaluate for complex expressions #}
<p>{{ patient | fhirpathEvaluate("Bundle.entry.first().resource.name.first().text") }}</p>
```

REST sources work the same way — the response body is available directly:

```json
"patientProfile": {
  "api": "rest",
  "resource": "/openmrs/ws/rest/v1/patientprofile/{{patientUuid}}",
  "params": { "v": "full" }
}
```

```html
<p>{{ patientProfile.patient.auditInfo.dateCreated | dateFormat }}</p>
```

**When to use direct source access vs `compute.js`:**

| Approach | Use when |
|---|---|
| Direct `{{ sourceName.* }}` | Simple field display, single template, no transformation needed |
| `compute.js` | Logic, grouping, conditionals, cross-source joins, or reuse across templates |

### Extending base layouts

```html
{% extends "_base/landscape.html" %}

{% block title %}{{ 'REGISTRATION_CARD' | t }}{% endblock %}

{% block styles %}
  /* your custom CSS here */
{% endblock %}

{% block content %}
  <!-- your content here -->
{% endblock %}
```

### Common Nunjucks patterns

Display with fallback:
```html
{{ computed.patientName | default('Unknown') }}
```

Conditional:
```html
{% if computed.photoUrl %}
  <img src="{{ computed.photoUrl }}" style="width: 20mm; height: 20mm;" />
{% endif %}

{% if data.showWatermark %}
  <div class="watermark">DRAFT</div>
{% endif %}
```

Loop over a list:
```html
{% for drug in computed.medications %}
  <tr>
    <td>{{ drug.drugName }}</td>
    <td>{{ drug.dose | default('—') }}</td>
  </tr>
{% else %}
  <tr><td colspan="2">No medications.</td></tr>
{% endfor %}
```

Loop with index:
```html
{% for item in computed.items %}
  <p>{{ loop.index }}. {{ item.name }}</p>
{% endfor %}
```

---

## 7. Nunjucks filter reference

Custom filters registered by the service. All available in every template.

### `| t` — translate

Looks up a key in `_i18n/<locale>.json`. Falls back to English, then to the raw key.

```html
{{ 'PATIENT_NAME' | t }}
{{ 'WEIGHT' | t('fr') }}               {# force French regardless of request locale #}
{{ 'NAME' | t }} / {{ 'NAME' | t('en') }}  {# bilingual label #}
```

### `| barcode(type, height)` — traditional barcode

Generates a barcode as a base64-encoded PNG `<img>` tag. Output is HTML-safe.

`type` is any valid bwip-js `bcid`. Common types:

| Type | Description |
|---|---|
| `code128` | Most common — alphanumeric, compact |
| `code39` | Older standard — uppercase letters and digits only |
| `pdf417` | 2D, higher data density |
| `datamatrix` | 2D square matrix |

```html
{{ computed.patientId | barcode('code128', 40) }}
```

Falls back to `<span class="barcode-fallback">value</span>` if generation fails.

### `| qrcode(size)` — QR code

Generates a QR code as an inline SVG. Output is HTML-safe. `size` is width/height in pixels (default: 120).

```html
{{ computed.patientId | qrcode(80) }}
```

Falls back to `<span class="qrcode-fallback">value</span>` if generation fails.

> **Note:** Put the QR code in the same `<td>` as the patient ID text — not a separate extra column.
>
> ```html
> <td>
>   {{ computed.patientId | default('') }}<br>
>   {{ computed.patientId | qrcode(80) }}
> </td>
> ```

### `| dateFormat` — format a date

Formats an ISO 8601 date string using the request locale.

```html
{{ computed.registrationDate | dateFormat }}    {# → "05 May 2026" #}
```

### `| age` — compute age from birthdate

Returns a human-readable age string. Prefer computing age in `compute.js` and returning it directly — use this filter only when you have a raw birthdate available in the template.

```html
{{ computed.birthDate | age }}    {# → "33 years" / "4 months" / "14 days" #}
```

### `| round(decimals)` — round a number

```html
{{ computed.bmi | round(1) }}    {# → "24.3" #}
```

### `| fhirpathEvaluate(expression)` — inline FHIRPath

Evaluates a FHIRPath expression on an object in the template. Useful for per-row extraction inside `{% for %}` loops over raw FHIR resources.

```html
{% for entry in patient.entry %}
  <td>{{ entry.resource | fhirpathEvaluate("Patient.name.first().text") }}</td>
{% endfor %}
```

### Nunjucks built-in filters

| Filter | Example | Output |
|---|---|---|
| `\| upper` | `{{ computed.gender \| upper }}` | `MALE` |
| `\| lower` | `{{ 'HELLO' \| lower }}` | `hello` |
| `\| capitalize` | `{{ computed.gender \| capitalize }}` | `Male` |
| `\| default(val)` | `{{ computed.phone \| default('N/A') }}` | `N/A` if empty |
| `\| first` | `{{ computed.items \| first }}` | First element |
| `\| last` | `{{ computed.items \| last }}` | Last element |
| `\| length` | `{{ computed.items \| length }}` | Count |
| `\| join(', ')` | `{{ computed.tags \| join(', ') }}` | `"a, b, c"` |
| `\| truncate(n)` | `{{ computed.notes \| truncate(80) }}` | First 80 chars + … |

Full list: [Nunjucks built-in filters](https://mozilla.github.io/nunjucks/templating.html#builtin-filters)

---

## 8. i18n — translations

**Location:** `print-templates/_i18n/<locale>.json`

```json
{
  "PATIENT_NAME": "Patient Name",
  "AGE":          "Age",
  "GENDER":       "Gender",
  "REGISTRATION": "Registration No.",
  "DATED":        "Date"
}
```

Add a new locale by creating `_i18n/<locale-code>.json`. The `| t` filter falls back through: requested locale → English → raw key.

Translation files are mtime-cached — edits are picked up on the next request with no restart.

---

## 9. styles.css — custom styles

**Location:** `print-templates/<folder>/styles.css`

If this file exists, its contents are injected as an inline `<style>` block into the rendered HTML (inside `<head>` if present, otherwise prepended). Use it to override base layout styles for a specific template without modifying `_base/*.html`.

---

## 10. Worked example — Registration card

### data-config.json

Declares the three API calls. No transformation here.

```json
{
  "sources": {
    "patient": {
      "api": "fhir",
      "resource": "Patient",
      "params": { "_id": "{{patientUuid}}" }
    },
    "relatives": {
      "api": "fhir",
      "resource": "RelatedPerson",
      "params": { "patient": "{{patientUuid}}" }
    },
    "patientProfile": {
      "api": "rest",
      "resource": "/openmrs/ws/rest/v1/patientprofile/{{patientUuid}}",
      "params": { "v": "full" }
    }
  }
}
```

### compute.js

Extracts all fields from resolved sources.

```js
module.exports = {
  compute: async function ({ context, data, resolved, ValidationError }) {
    const patient  = resolved?.patient?.entry?.[0]?.resource;
    const relative = resolved?.relatives?.entry?.[0]?.resource;
    const profile  = resolved?.patientProfile;

    const officialId = patient?.identifier?.find((id) => id.use === 'official');

    return {
      patientId:             officialId?.value ?? '',
      patientName:           patient?.name?.[0]?.text ?? '',
      birthDate:             patient?.birthDate ?? '',
      age:                   computeAge(patient?.birthDate),
      gender:                patient?.gender ?? '',
      phone:                 patient?.telecom?.find((t) => t.system === 'phone')?.value ?? '',
      address:               patient?.address?.[0]?.text ?? '',
      village:               patient?.address?.[0]?.city ?? '',
      tehsil:                patient?.address?.[0]?.district ?? '',
      registrationDate:      profile?.patient?.auditInfo?.dateCreated ?? '',
      nextOfKinName:         relative?.name?.[0]?.text ?? '',
      nextOfKinRelationship: relative?.relationship?.[0]?.text ?? '',
      photoUrl:              `/openmrs/ws/rest/v1/patientImage?patientUuid=${context.patientUuid}`,
    };
  },
};

function computeAge(birthDate) {
  if (!birthDate) return '';
  const birth  = new Date(birthDate);
  const now    = new Date();
  const days   = Math.floor((now - birth) / (1000 * 60 * 60 * 24));
  if (days < 30)   return `${days} days`;
  const months = Math.floor(days / 30.44);
  if (months < 12) return `${months} months`;
  return `${Math.floor(months / 12)} years`;
}
```

### template.html

Every value comes from `{{ computed.* }}`.

```html
{% extends "_base/landscape.html" %}
{% block content %}
<table class="registrationCard-details">
  <tr>
    <td>{{ 'DATED' | t }} :</td>
    <td>{{ computed.registrationDate | dateFormat | default('') }}</td>
  </tr>
  <tr>
    <td>{{ 'REGISTRATION' | t }} :</td>
    <td>{{ computed.patientId | default('') }}</td>
  </tr>
  <tr>
    <td>{{ 'NAME' | t }} :</td>
    <td>{{ computed.patientName | default('') }}</td>
  </tr>
  <tr>
    <td>{{ 'AGE' | t }} :</td>
    <td>{{ computed.age | default('') }}</td>
  </tr>
  <tr>
    <td>{{ 'GENDER' | t }} :</td>
    <td>{{ computed.gender | upper | first | default('') }}</td>
  </tr>
  <tr>
    <td>{{ 'ADDRESS' | t }} :</td>
    <td>{{ computed.address | default('') }}</td>
  </tr>
  <tr>
    <td>{{ 'VILLAGE' | t }} :</td>
    <td>{{ computed.village | default('') }}</td>
  </tr>
  <tr>
    <td>{{ 'TEHSIL' | t }} :</td>
    <td>{{ computed.tehsil | default('') }}</td>
  </tr>
</table>
{% if computed.photoUrl %}
  <img src="{{ computed.photoUrl }}" style="width:20mm;height:20mm;"
       onerror="this.style.display='none'" />
{% endif %}
{% endblock %}
```

---

## 11. Worked example — Prescription

### data-config.json

```json
{
  "sources": {
    "patient": {
      "api": "fhir",
      "resource": "Patient",
      "params": { "_id": "{{patientUuid}}" }
    },
    "medicationRequests": {
      "api": "fhir",
      "resource": "MedicationRequest",
      "params": {
        "patient": "{{patientUuid}}",
        "_include": "MedicationRequest:encounter",
        "_sort": "-_lastUpdated",
        "_count": "100"
      }
    }
  }
}
```

### compute.js

Validates inputs, extracts patient fields, and groups medications by encounter.

```js
module.exports = {
  compute: async function ({ context, resolved, data, ValidationError }) {
    if (!context?.patientUuid) throw new ValidationError('patientUuid is required');
    if (!context?.visitUuid)   throw new ValidationError('visitUuid is required');

    const patient    = resolved?.patient?.entry?.[0]?.resource;
    const officialId = patient?.identifier?.find((id) => id.use === 'official');

    const entries = resolved?.medicationRequests?.entry ?? [];
    const byType  = (type) => entries.filter(e => e.resource?.resourceType === type).map(e => e.resource);

    const encounterResources = byType('Encounter');
    const visitRef           = `Encounter/${context.visitUuid}`;
    const visitEncounterIds  = new Set(
      encounterResources
        .filter(enc => enc.partOf?.reference === visitRef)
        .map(enc => enc.id),
    );
    const encounterMap = new Map(encounterResources.map(e => [e.id, e]));

    const byEncounter = new Map();
    for (const mr of byType('MedicationRequest')) {
      const encId = mr.encounter?.reference?.split('/')?.[1] ?? '';
      if (!visitEncounterIds.has(encId)) continue;
      if (!byEncounter.has(encId)) byEncounter.set(encId, []);
      byEncounter.get(encId).push(mr);
    }

    const firstStart = [...byEncounter.keys()]
      .map(id => encounterMap.get(id)?.period?.start)
      .find(Boolean);

    const encounters = [...byEncounter.entries()].map(([encId, meds]) => ({
      doctorName: encounterMap.get(encId)?.participant?.[0]?.individual?.display ?? '',
      drugOrders: meds.map(mr => {
        const stopped = ['stopped', 'cancelled'].includes(mr.status);
        return {
          drugName:           mr.medicationCodeableConcept?.text ?? '',
          dosageInstructions: buildDosageInstructions(mr.dosageInstruction),
          startDate:          formatDate(mr.authoredOn ?? ''),
          stopped,
          stoppedDate:        stopped ? formatDate(mr.dispenseRequest?.validityPeriod?.end ?? '') : '',
          treatmentNotes:     mr.note?.[0]?.text ?? '',
        };
      }),
    }));

    return {
      patientName: patient?.name?.[0]?.text ?? '',
      patientId:   officialId?.value ?? '',
      age:         computeAge(patient?.birthDate),
      gender:      patient?.gender ?? '',
      village:     patient?.address?.[0]?.city ?? '',
      district:    patient?.address?.[0]?.district ?? '',
      visitDate:   firstStart ? formatDate(firstStart) : '',
      encounters,
    };
  },
};

function computeAge(birthDate) {
  if (!birthDate) return '';
  const days = Math.floor((new Date() - new Date(birthDate)) / (1000 * 60 * 60 * 24));
  if (days < 30)   return `${days} days`;
  const months = Math.floor(days / 30.44);
  if (months < 12) return `${months} months`;
  return `${Math.floor(months / 12)} years`;
}

function buildDosageInstructions(dosageInstruction) {
  const d = dosageInstruction?.[0];
  if (!d) return '';
  const parts = [];
  const doseQty = d.doseAndRate?.[0]?.doseQuantity;
  if (doseQty?.value != null) parts.push(`${doseQty.value} ${doseQty.unit ?? ''}`.trim());
  const frequency = d.timing?.code?.text;
  if (frequency) parts.push(frequency);
  if (d.asNeededBoolean) parts.push('SOS');
  const route = d.route?.text;
  if (route) parts.push(route);
  const repeat = d.timing?.repeat;
  if (repeat?.duration != null) return `${parts.join(', ')} - ${repeat.duration} ${durationLabel(repeat.durationUnit)}`;
  return parts.join(', ');
}

function durationLabel(code) {
  const map = { s: 'Second(s)', min: 'Minute(s)', h: 'Hour(s)', d: 'Day(s)', wk: 'Week(s)', mo: 'Month(s)', a: 'Year(s)' };
  return map[code] ?? code ?? '';
}

function formatDate(value) {
  if (!value) return '';
  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) return '';
    return `${String(date.getDate()).padStart(2, '0')} ${date.toLocaleDateString('en', { month: 'long' })} ${date.getFullYear()}`;
  } catch { return ''; }
}
```

### template.html

```html
{% extends "_base/portrait.html" %}
{% block content %}

<div class="patient-info">
  <table>
    <tr>
      <td>Name: {{ computed.patientName | default('') }}</td>
      <td>Age: {{ computed.age | default('') }} ({{ computed.gender | capitalize | default('') }})</td>
      <td>Registration No: {{ computed.patientId | default('') }}</td>
    </tr>
    <tr>
      <td>Village: {{ computed.village | default('') }}</td>
      <td>District: {{ computed.district | default('') }}</td>
      <td>Visit Date: {{ computed.visitDate | default('') }}</td>
    </tr>
  </table>
</div>

{% for encounter in computed.encounters %}
<h3>Consultation with {{ encounter.doctorName | default('') }}</h3>
<table class="prescription-table">
  <tr>
    <th>S. No.</th><th>Drug Name</th><th>Dosage Instructions</th><th>Start Date</th>
  </tr>
  {% for drug in encounter.drugOrders %}
  <tbody>
    <tr>
      <td>{{ loop.index }}.</td>
      <td class="{{ 'strike-text' if drug.stopped }}">{{ drug.drugName }}</td>
      <td>
        <span class="{{ 'strike-text' if drug.stopped }}">
          {{ drug.dosageInstructions | default('—') }}
        </span>
        {% if drug.stopped and drug.stoppedDate %}
          <span>stopped {{ drug.stoppedDate }}</span>
        {% endif %}
      </td>
      <td>{{ drug.startDate | default('') }}</td>
    </tr>
    {% if drug.treatmentNotes %}
    <tr>
      <td></td><td></td>
      <td colspan="2"><strong>Treatment Notes:</strong> {{ drug.treatmentNotes }}</td>
    </tr>
    {% endif %}
  </tbody>
  {% endfor %}
</table>
{% else %}
<p>No medications prescribed for this visit.</p>
{% endfor %}

{% endblock %}
```

---

## 12. Passing caller data into a template

The `data` field in the render request lets the caller inject arbitrary values directly into the template and `compute.js` — without any OpenMRS API call.

**Request:**
```json
{
  "templateId": "PRESCRIPTION_V1",
  "locale": "en",
  "context": { "patientUuid": "...", "visitUuid": "..." },
  "data": {
    "printedBy": "Dr. Smith",
    "showWatermark": true
  }
}
```

**In `compute.js`:**
```js
compute: async function ({ context, resolved, data, ValidationError }) {
  return {
    printedBy: data?.printedBy ?? '',
    // ...
  };
}
```

**In `template.html`:**
```html
{% if data.showWatermark %}<div class="watermark">DRAFT</div>{% endif %}
<p>Printed by: {{ data.printedBy | default('') }}</p>
```

---

## 13. Testing a template

After creating or editing a template, test it with curl using a real JSESSIONID (DevTools → Network → any request → Request Headers → Cookie):

```bash
curl -s -X POST http://localhost:8080/template-service/api/render \
  -H "Content-Type: application/json" \
  -H "Cookie: JSESSIONID=<your-session-id>" \
  -d '{
    "templateId": "REG_CARD_V1",
    "format": "html",
    "locale": "en",
    "context": { "patientUuid": "<real-patient-uuid>" }
  }' > /tmp/rendered.html && open /tmp/rendered.html
```

Verify barcodes and QR codes are present:
```bash
grep -c 'data:image/png;base64' /tmp/rendered.html   # barcode count
grep -c '<svg' /tmp/rendered.html                     # qrcode count
```

Check the service logs for errors:
```bash
docker logs bahmni-standard-template-service-1 --tail 30
```

List all registered templates:
```bash
curl -s http://localhost:8080/template-service/api/templates | jq .
```

---

## 14. Common pitfalls

### Putting a `computed` block in data-config.json

`data-config.json` is sources only. All field extraction belongs in `compute.js`.

```json
// Wrong
{ "sources": { ... }, "computed": { ... } }

// Correct
{ "sources": { ... } }
```

### Using `rest` with a short path

For `rest` sources, always provide the full path from the domain root.

```json
// Wrong
{ "api": "rest", "resource": "patientprofile/{{patientUuid}}" }

// Correct
{ "api": "rest", "resource": "/openmrs/ws/rest/v1/patientprofile/{{patientUuid}}" }
```

### Not handling empty bundles

```js
// Unsafe
const patient = resolved.patient.entry[0].resource;

// Safe
const patient = resolved?.patient?.entry?.[0]?.resource;
```

### Returning an array instead of an object from compute.js

```js
// Wrong
return ['a', 'b'];

// Correct
return { items: ['a', 'b'] };
```

### QR code in a separate table column

```html
<!-- Wrong: extra column gets pushed off the visible card area -->
<td>{{ computed.patientId }}</td>
<td>{{ computed.patientId | qrcode(80) }}</td>

<!-- Correct: inline in the same cell -->
<td>
  {{ computed.patientId | default('') }}<br>
  {{ computed.patientId | qrcode(80) }}
</td>
```

### Using `| barcode('qrcode', ...)` instead of `| qrcode`

```html
<!-- Wrong -->
{{ computed.patientId | barcode('qrcode', 80) }}

<!-- Correct -->
{{ computed.patientId | qrcode(80) }}             {# QR code (SVG) #}
{{ computed.patientId | barcode('code128', 40) }} {# traditional barcode (PNG) #}
```

### Throwing a plain Error for input validation

```js
// Wrong — causes a 500 instead of 400
throw new Error('visitUuid is required');

// Correct
throw new ValidationError('visitUuid is required');
```

---

## 15. API reference

### `POST /template-service/api/render`

**Request body:**
```json
{
  "templateId": "PRESCRIPTION_V1",
  "format": "html",
  "locale": "en",
  "context": {
    "patientUuid": "ae94ad73-ac02-42ab-aa04-fe658fb7c091",
    "visitUuid": "14ee47a3-b093-4e0e-b718-d68fcf2666ab"
  },
  "data": {
    "printedBy": "Dr. Smith"
  }
}
```

| Field | Required | Default | Description |
|---|---|---|---|
| `templateId` | Yes | — | ID from `templates.json` |
| `format` | No | `"html"` | Only `"html"` is supported |
| `locale` | No | `"en"` | BCP 47 locale tag for translations and date formatting |
| `context` | No | `{}` | UUIDs passed to `data-config.json` placeholders and `compute.js` |
| `data` | No | `{}` | Free-form object available as `{{ data.* }}` in templates and `data` in `compute.js` |

**Response:** `{ "html": "<rendered HTML string>" }`

### `GET /template-service/api/templates`

Returns all registered templates.

**Response:** `{ "templates": [{ "id": "...", "name": "..." }] }`

### `GET /template-service/health`

**Response:** `{ "status": "ok", "timestamp": "..." }`

### Authentication

Pass the user's OpenMRS session using one of:

| Header | Value |
|---|---|
| `Cookie` | `JSESSIONID=<session-id>` |
| `X-OpenMRS-Session-Id` | `<session-id>` |
| `X-OpenMRS-Authorization` | `Basic <base64>` |

---

## 16. Environment variables

| Variable | Default | Description |
|---|---|---|
| `OPENMRS_URL` | `http://openmrs:8080` | OpenMRS instance base URL |
| `OPENMRS_TIMEOUT_MS` | `10000` | API request timeout in milliseconds |
| `TEMPLATES_DIR` | `/etc/bahmni_config/print-templates` | Template directory mount path |
| `PORT` | `8080` | Service HTTP port |
| `LOG_LEVEL` | `info` | Log level (`trace`, `debug`, `info`, `warn`, `error`, `fatal`) |
