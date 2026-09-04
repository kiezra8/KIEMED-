/**
 * Ugandan Clinical Guidelines (UCG), IMNCI, APGAR, and BMI Clinical Logic
 * Designed for KIEMED Hospital Management System
 */

// ── BMI Calculation & Interpretation ──────────────────────────────────────────
export function calculateBMI(weightKg, heightCm) {
  const w = parseFloat(weightKg)
  const h = parseFloat(heightCm)
  if (!w || !h || w <= 0 || h <= 0) return null

  const heightM = h / 100
  const bmi = (w / (heightM * heightM)).toFixed(1)
  const numBmi = parseFloat(bmi)

  let category = 'Normal'
  let color = 'var(--success, #10b981)'
  let advice = 'Healthy weight range. Maintain balanced diet and active lifestyle.'

  if (numBmi < 18.5) {
    category = 'Underweight'
    color = 'var(--warning, #f59e0b)'
    advice = 'Assess nutritional status, consider dietary supplementation or chronic illness check.'
  } else if (numBmi >= 25 && numBmi < 29.9) {
    category = 'Overweight'
    color = 'var(--warning, #f59e0b)'
    advice = 'Advise lifestyle, diet modification, and exercise.'
  } else if (numBmi >= 30) {
    category = 'Obese'
    color = 'var(--danger, #ef4444)'
    advice = 'Assess for hypertension, diabetes, cardiovascular risks. Refer to nutrition.'
  }

  return { bmi: numBmi, category, color, advice }
}

// ── APGAR Score (Maternity & Newborn Assessment) ──────────────────────────────
export const APGAR_CRITERIA = {
  appearance: {
    label: 'Appearance (Color)',
    options: [
      { score: 0, label: '0 - Blue or pale all over' },
      { score: 1, label: '1 - Body pink, extremities blue (Acrocyanosis)' },
      { score: 2, label: '2 - Completely pink' },
    ]
  },
  pulse: {
    label: 'Pulse (Heart Rate)',
    options: [
      { score: 0, label: '0 - Absent' },
      { score: 1, label: '1 - Below 100 bpm' },
      { score: 2, label: '2 - 100 bpm or greater' },
    ]
  },
  grimace: {
    label: 'Grimace (Reflex Irritability)',
    options: [
      { score: 0, label: '0 - Floppy / No response to stimulation' },
      { score: 1, label: '1 - Grimace / feeble cry on suction or flick' },
      { score: 2, label: '2 - Vigorous cry, cough, or sneeze' },
    ]
  },
  activity: {
    label: 'Activity (Muscle Tone)',
    options: [
      { score: 0, label: '0 - Flaccid, limp' },
      { score: 1, label: '1 - Some flexion of arms and legs' },
      { score: 2, label: '2 - Active motion, well-flexed limbs' },
    ]
  },
  respiration: {
    label: 'Respiration (Breathing Effort)',
    options: [
      { score: 0, label: '0 - Absent (Apneic)' },
      { score: 1, label: '1 - Slow, irregular, weak cry' },
      { score: 2, label: '2 - Good, strong lusty cry' },
    ]
  },
}

export function computeApgarTotal(scores) {
  const sum = (scores.appearance || 0) +
              (scores.pulse || 0) +
              (scores.grimace || 0) +
              (scores.activity || 0) +
              (scores.respiration || 0)

  let interpretation = 'Normal / Vigorous Newborn'
  let color = 'var(--success, #10b981)'
  let action = 'Routine newborn care: dry, keep warm, clear airway if needed, skin-to-skin contact, initiate breastfeeding within 1 hour.'

  if (sum <= 3) {
    interpretation = 'Critically Depressed (Severe Asphyxia)'
    color = 'var(--danger, #ef4444)'
    action = 'IMMEDIATE RESUSCITATION: Call senior midwife/doctor. Warm, stimulate, position airway, begin bag-valve-mask (BVM) ventilation with room air, monitor heart rate, prepare oxygen.'
  } else if (sum <= 6) {
    interpretation = 'Moderately Depressed'
    color = 'var(--warning, #f59e0b)'
    action = 'Supportive care: Clear secretions, stimulate, suction gently, provide tactile stimulation and supplemental warmth. Reassess at 5 minutes.'
  }

  return { total: sum, interpretation, color, action }
}

// ── IMNCI Module (Uganda MoH Child Protocol: 2 months to 5 years) ────────────
export const IMNCI_DANGER_SIGNS = [
  { id: 'not_feeding', label: 'Unable to drink or breastfeed' },
  { id: 'vomiting_all', label: 'Vomits everything' },
  { id: 'convulsions', label: 'Convulsions now or history in this illness' },
  { id: 'lethargic', label: 'Lethargic or unconscious' },
  { id: 'stridor', label: 'Stridor in a calm child' },
]

export const FAST_BREATHING_THRESHOLDS = {
  // Age in months -> breaths per minute cutoff
  infant_2_to_11m: 50,
  child_12_to_59m: 40,
}

export function evaluateIMNCI({
  ageMonths = 12,
  dangerSigns = [],
  respiratoryRate = 0,
  chestIndrawing = false,
  stridor = false,
  fever = false,
  malariaRdt = 'Pending', // Positive, Negative, Pending
  stiffNeck = false,
  diarrheaDays = 0,
  sunkenEyes = false,
  skinPinch = 'Normal', // 'Normal' (<1s), 'Slow' (1-2s), 'Very Slow' (>2s)
  bloodInStool = false,
  muacMm = 130, // Mid-Upper Arm Circumference in mm
  bilateralEdema = false, // Kwashiorkor
}) {
  const classifications = []
  let urgentReferral = false

  // 1. General Danger Signs
  if (dangerSigns.length > 0 || stridor || stiffNeck) {
    urgentReferral = true
    classifications.push({
      category: 'General Danger Sign',
      severity: 'RED',
      title: 'VERY SEVERE DISEASE',
      treatment: 'Urgent referral/admission. Give first dose of IV/IM Ampicillin + Gentamicin or Ceftriaxone. Prevent hypoglycemia. Keep warm.',
    })
  }

  // 2. Cough / Breathing Assessment
  const cutoff = ageMonths < 12 ? 50 : 40
  const isFastBreathing = respiratoryRate >= cutoff

  if (chestIndrawing || stridor) {
    urgentReferral = true
    classifications.push({
      category: 'Respiratory',
      severity: 'RED',
      title: 'SEVERE PNEUMONIA OR VERY SEVERE DISEASE',
      treatment: 'Admit or refer urgently. Give first dose of appropriate antibiotic (Ampicillin + Gentamicin or Benzylpenicillin). Administer Oxygen if SpO2 < 90%.',
    })
  } else if (isFastBreathing) {
    classifications.push({
      category: 'Respiratory',
      severity: 'YELLOW',
      title: 'PNEUMONIA',
      treatment: 'Give oral Amoxicillin dispersible tablets (40-50 mg/kg/dose BD for 5 days) as per Uganda MoH IMNCI guidelines. Advise mother to return in 2 days or sooner if danger signs appear.',
    })
  } else {
    classifications.push({
      category: 'Respiratory',
      severity: 'GREEN',
      title: 'NO PNEUMONIA (COUGH OR COLD)',
      treatment: 'Home care: soothe the throat and relieve cough with safe remedies (warm breastmilk/warm tea/honey for >1yr). Return immediately if fast breathing or danger signs develop.',
    })
  }

  // 3. Dehydration / Diarrhea
  if (diarrheaDays > 0) {
    if (skinPinch === 'Very Slow' || (sunkenEyes && dangerSigns.includes('not_feeding'))) {
      urgentReferral = true
      classifications.push({
        category: 'Diarrhea',
        severity: 'RED',
        title: 'SEVERE DEHYDRATION',
        treatment: 'Give IV Ringer’s Lactate or Normal Saline immediately (Plan C - 100 ml/kg). Reassess hourly. Continue breastfeeding.',
      })
    } else if (skinPinch === 'Slow' || sunkenEyes) {
      classifications.push({
        category: 'Diarrhea',
        severity: 'YELLOW',
        title: 'SOME DEHYDRATION',
        treatment: 'Give Oral Rehydration Salts (ORS Plan B: 75 ml/kg over 4 hours). Prescribe Zinc sulphate dispersible tablets 20mg daily for 10-14 days (10mg if <6 months).',
      })
    } else {
      classifications.push({
        category: 'Diarrhea',
        severity: 'GREEN',
        title: 'NO DEHYDRATION',
        treatment: 'Plan A home care: extra fluids + ORS packets after each loose stool. Zinc tablets for 10-14 days. Continued feeding.',
      })
    }

    if (bloodInStool) {
      classifications.push({
        category: 'Diarrhea',
        severity: 'YELLOW',
        title: 'DYSENTERY',
        treatment: 'Give oral Ciprofloxacin (15 mg/kg BD for 3 days) or Azithromycin as per Uganda MoH guidelines. Follow-up in 2 days.',
      })
    }
  }

  // 4. Fever / Malaria
  if (fever || malariaRdt === 'Positive') {
    if (dangerSigns.length > 0 || stiffNeck) {
      urgentReferral = true
      classifications.push({
        category: 'Fever',
        severity: 'RED',
        title: 'VERY SEVERE FEBRILE DISEASE / SEVERE MALARIA',
        treatment: 'Give first dose of IV/IM Artesunate (2.4 mg/kg, 3.0 mg/kg if <20kg) immediately at 0h, 12h, 24h. Treat high fever with Paracetamol. Urgent referral if health centre cannot manage.',
      })
    } else if (malariaRdt === 'Positive') {
      classifications.push({
        category: 'Fever',
        severity: 'YELLOW',
        title: 'CONFIRMED MALARIA (UNCOMPLICATED)',
        treatment: 'First line Uganda MoH: Artemether-Lumefantrine (Coartem) orally with fatty meal/milk twice daily for 3 days. Paracetamol for fever relief.',
      })
    }
  }

  // 5. Malnutrition / Nutritional Assessment
  if (bilateralEdema || muacMm < 115) {
    urgentReferral = true
    classifications.push({
      category: 'Nutrition',
      severity: 'RED',
      title: 'SEVERE ACUTE MALNUTRITION (SAM)',
      treatment: bilateralEdema
        ? 'Bilateral pitting edema indicates Kwashiorkor. Admit to inpatient Therapeutic Care (ITC) with F-75 milk.'
        : 'MUAC < 11.5 cm. Check appetite test. If good appetite and no complications, enroll in Outpatient Therapeutic Program (OTP) with RUTF (Ready-to-Use Therapeutic Food) and Amoxicillin.',
    })
  } else if (muacMm >= 115 && muacMm < 125) {
    classifications.push({
      category: 'Nutrition',
      severity: 'YELLOW',
      title: 'MODERATE ACUTE MALNUTRITION (MAM)',
      treatment: 'Enroll in Supplementary Feeding Program (CSB++ / Supercereal). Counseling on infant and young child feeding (IYCF). Follow up in 14 days.',
    })
  }

  return { classifications, urgentReferral }
}

// ── Common Diagnoses in Uganda Clinical Guidelines (UCG) ────────────────────
export const UGANDA_COMMON_DIAGNOSES = [
  'Malaria (Uncomplicated) - MoH UCG',
  'Severe Malaria (Cerebral/Severe Anemia) - MoH UCG',
  'Pneumonia (Community-Acquired) - MoH UCG',
  'Upper Respiratory Tract Infection (URTI) / Common Cold',
  'Acute Gastroenteritis / Diarrhea Disease',
  'Dysentery (Bacillary / Amoebic)',
  'Typhoid Fever (Enteric Fever)',
  'Urinary Tract Infection (UTI)',
  'Peptic Ulcer Disease (PUD) / Gastritis',
  'Hypertension (Essential / Grade 1-3)',
  'Diabetes Mellitus (Type 1 / Type 2)',
  'Pelvic Inflammatory Disease (PID)',
  'Sexually Transmitted Infections (Syphilis, Gonorrhea, Chlamydia)',
  'Skin / Soft Tissue Infection (Cellulitis, Abscess, Scabies)',
  'Helminthiasis (Intestinal Worms)',
  'Tuberculosis (Pulmonary / Extra-pulmonary)',
  'Anemia (Iron Deficiency / Malaria-induced / Nutritional)',
  'Maternity: Antenatal Care Normal Pregnancy',
  'Maternity: Pre-Eclampsia / Eclampsia',
  'Maternity: Postpartum Hemorrhage (PPH)',
  'Maternity: Normal Spontaneous Vaginal Delivery (SVD)',
  'Trauma / Laceration / Fracture',
]
