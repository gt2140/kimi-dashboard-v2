import type { Bounty } from "./types";

export const bountySeedData: Bounty[] = [
  {
    id: 1,
    title: "Develop CKD Progression Prediction Agent",
    description:
      "Build an AI agent that predicts chronic kidney disease progression using clinical biomarkers and patient history data.",
    fullDescription:
      "We need a specialized AI agent capable of analyzing longitudinal clinical data to predict chronic kidney disease (CKD) progression stages. The agent should integrate with existing EHR systems, process lab results (eGFR, creatinine, BUN), and provide risk scores for disease progression. Output should include confidence intervals and recommended monitoring intervals.",
    type: "Foundation",
    reward: 2500,
    status: "Open",
    submissions: 3,
    deadline: "May 15, 2026",
    createdAt: "Apr 28, 2026",
    requester: "Aura Foundation",
    requesterAvatar: "AF",
    tags: ["AI Agent", "Nephrology", "Prediction"],
    successCriteria:
      "Agent achieves >85% AUC-ROC on held-out test set. Must include documentation, reproducible training pipeline, and integration API.",
    submissionsList: [
      {
        id: 1,
        contributor: "Dr. Chen",
        contributorAvatar: "DC",
        summary: "LSTM-based model with 87% AUC-ROC",
        status: "Pending",
        submittedAt: "May 2, 2026",
      },
      {
        id: 2,
        contributor: "MedAI Labs",
        contributorAvatar: "ML",
        summary: "Transformer architecture approach",
        status: "Pending",
        submittedAt: "May 3, 2026",
      },
      {
        id: 3,
        contributor: "Sarah Kim",
        contributorAvatar: "SK",
        summary: "Gradient boosting + clinical rules hybrid",
        status: "Pending",
        submittedAt: "May 4, 2026",
      },
    ],
  },
  {
    id: 2,
    title: "Curate Diabetes Dataset for Latin America",
    description:
      "Compile and validate a comprehensive diabetes dataset covering demographics, treatments, and outcomes across LATAM.",
    fullDescription:
      "Create a high-quality, ethically-sourced diabetes dataset spanning at least 5 Latin American countries. The dataset should include demographic data, clinical measurements (HbA1c, fasting glucose, BMI), treatment regimens, complication outcomes, and follow-up data. Minimum 50,000 patient records with proper de-identification and consent documentation.",
    type: "Foundation",
    reward: 1800,
    status: "Open",
    submissions: 7,
    deadline: "May 20, 2026",
    createdAt: "Apr 25, 2026",
    requester: "Aura Foundation",
    requesterAvatar: "AF",
    tags: ["Dataset", "Diabetes", "LATAM"],
    successCriteria:
      "Dataset contains >50k validated records from 5+ countries. Must pass quality checks, include data dictionary, and have documented ethical approval.",
    submissionsList: [
      {
        id: 4,
        contributor: "DataMed",
        contributorAvatar: "DM",
        summary: "Dataset from Brazil and Mexico (62k records)",
        status: "Pending",
        submittedAt: "Apr 30, 2026",
      },
      {
        id: 5,
        contributor: "ClinicaSur",
        contributorAvatar: "CS",
        summary: "Argentina + Chile dataset (48k records)",
        status: "Pending",
        submittedAt: "May 1, 2026",
      },
      {
        id: 6,
        contributor: "ResearchHub",
        contributorAvatar: "RH",
        summary: "Multi-country compilation (71k records)",
        status: "Pending",
        submittedAt: "May 2, 2026",
      },
    ],
  },
  {
    id: 3,
    title: "Validate Oncology Protocol v2.1",
    description:
      "Independent validation of the updated oncology treatment protocol including edge cases and safety checks.",
    fullDescription:
      "The oncology treatment protocol v2.1 needs independent validation by a qualified clinical researcher. Review the protocol documentation, test against simulated patient cases including edge cases (rare mutations, drug interactions, pediatric considerations), and provide a detailed validation report with findings and recommendations.",
    type: "P2P",
    reward: 950,
    status: "In Progress",
    submissions: 1,
    deadline: "May 10, 2026",
    createdAt: "Apr 30, 2026",
    requester: "Memorial Cancer Institute",
    requesterAvatar: "MI",
    tags: ["Validation", "Oncology", "Protocol"],
    successCriteria:
      "Complete validation report covering all protocol steps, edge case analysis, and safety assessment. Report must be peer-review ready.",
    vaultContext: "Full protocol v2.1 documentation + 50 test cases attached",
    submissionsList: [
      {
        id: 7,
        contributor: "Dr. Patel",
        contributorAvatar: "DP",
        summary: "Validation report 80% complete",
        status: "Pending",
        submittedAt: "May 5, 2026",
      },
    ],
  },
  {
    id: 4,
    title: "Build Retinal Scan Analysis Pipeline",
    description:
      "Develop an end-to-end pipeline for automated retinal scan analysis with diabetic retinopathy detection.",
    fullDescription:
      "Build a production-ready ML pipeline that takes retinal fundus images as input and outputs diabetic retinopathy severity grading (0-4 scale). Pipeline should include preprocessing, model inference, quality checks, and structured output generation. Must handle batch processing and integrate with FHIR for result storage.",
    type: "Foundation",
    reward: 3200,
    status: "Under Review",
    submissions: 5,
    deadline: "May 8, 2026",
    createdAt: "Apr 20, 2026",
    requester: "Aura Foundation",
    requesterAvatar: "AF",
    tags: ["Pipeline", "Ophthalmology", "ML"],
    successCriteria:
      "Pipeline achieves >90% accuracy on Messidor-2 benchmark. Must include containerized deployment, API documentation, and FHIR integration.",
    submissionsList: [
      {
        id: 8,
        contributor: "VisionAI",
        contributorAvatar: "VA",
        summary: "CNN ensemble with 92% accuracy",
        status: "Pending",
        submittedAt: "Apr 28, 2026",
      },
      {
        id: 9,
        contributor: "RetinaLab",
        contributorAvatar: "RL",
        summary: "Full pipeline with FHIR integration",
        status: "Pending",
        submittedAt: "Apr 29, 2026",
      },
    ],
  },
  {
    id: 5,
    title: "Review Clinical Trial: Cardiology AI",
    description:
      "Peer review of the Cardiology AI clinical trial results focusing on methodology and statistical validity.",
    fullDescription:
      "Seeking an independent expert reviewer to evaluate the Cardiology AI clinical trial (NCT05981234). Focus areas: randomization methodology, statistical power analysis, primary endpoint evaluation, subgroup analysis, and adherence to CONSORT guidelines. Deliver a structured peer review report suitable for journal submission.",
    type: "P2P",
    reward: 600,
    status: "Open",
    submissions: 0,
    deadline: "May 25, 2026",
    createdAt: "May 1, 2026",
    requester: "HeartTech Research",
    requesterAvatar: "HT",
    tags: ["Peer Review", "Cardiology", "Clinical Trial"],
    successCriteria:
      "Structured peer review report addressing all methodology aspects. Must include specific recommendations for improvement.",
    vaultContext: "Trial protocol, raw data, and statistical analysis plan attached",
    submissionsList: [],
  },
  {
    id: 6,
    title: "Design Sepsis Early Warning System",
    description:
      "Create a real-time sepsis detection system integrating EHR data streams with predictive alerting.",
    fullDescription:
      "Design and prototype a sepsis early warning system that continuously monitors EHR data streams (vitals, labs, medications) and generates alerts when sepsis risk crosses thresholds. System should use SOFA/qSOFA criteria as baselines and enhance with ML predictions. Must include alert fatigue mitigation and clinical workflow integration design.",
    type: "Foundation",
    reward: 4000,
    status: "Open",
    submissions: 2,
    deadline: "May 30, 2026",
    createdAt: "Apr 22, 2026",
    requester: "Aura Foundation",
    requesterAvatar: "AF",
    tags: ["EHR Integration", "Sepsis", "Alert System"],
    successCriteria:
      "Working prototype with >85% sensitivity and <20% false positive rate. Must include clinical workflow design and alert fatigue analysis.",
    submissionsList: [
      {
        id: 10,
        contributor: "ICU Analytics",
        contributorAvatar: "IA",
        summary: "Real-time dashboard prototype",
        status: "Pending",
        submittedAt: "May 3, 2026",
      },
      {
        id: 11,
        contributor: "HealthGuard AI",
        contributorAvatar: "HG",
        summary: "ML model + alert framework",
        status: "Pending",
        submittedAt: "May 5, 2026",
      },
    ],
  },
  {
    id: 7,
    title: "Annotate Chest X-Ray Dataset (10k)",
    description:
      "Expert annotation of 10,000 chest X-ray images with pathology labels and confidence scores.",
    fullDescription:
      "We need board-certified radiologists or trained medical image annotators to label 10,000 chest X-ray images. Labels include: normal, pneumonia, pleural effusion, cardiomegaly, atelectasis, and nodule. Each image requires a primary label, confidence score (1-5), and bounding box for abnormal findings.",
    type: "P2P",
    reward: 1200,
    status: "In Progress",
    submissions: 4,
    deadline: "May 12, 2026",
    createdAt: "Apr 28, 2026",
    requester: "Radiology AI Corp",
    requesterAvatar: "RA",
    tags: ["Annotation", "Radiology", "Dataset"],
    successCriteria:
      "All 10k images annotated with >95% inter-annotator agreement. Must include quality control report.",
    vaultContext: "Image dataset + annotation guidelines + validation set attached",
    submissionsList: [
      {
        id: 12,
        contributor: "MedLabel Pro",
        contributorAvatar: "MP",
        summary: "4,200 images annotated",
        status: "Pending",
        submittedAt: "May 1, 2026",
      },
    ],
  },
  {
    id: 8,
    title: "Evaluate Dermatology Agent Accuracy",
    description:
      "Benchmark and evaluate the accuracy of the dermatology classification agent against gold-standard labels.",
    fullDescription:
      "Independent evaluation of the Aura dermatology classification agent. Test on a held-out dataset of 2,000 dermoscopy images with confirmed diagnoses across 7 skin condition categories. Evaluate accuracy, sensitivity, specificity, and fairness across skin tones. Deliver a comprehensive evaluation report.",
    type: "Foundation",
    reward: 1500,
    status: "Completed",
    submissions: 8,
    deadline: "May 1, 2026",
    createdAt: "Apr 10, 2026",
    requester: "Aura Foundation",
    requesterAvatar: "AF",
    tags: ["Evaluation", "Dermatology", "Benchmark"],
    successCriteria:
      "Comprehensive evaluation report with per-class metrics, fairness analysis, and comparison against published benchmarks.",
    submissionsList: [
      {
        id: 13,
        contributor: "DermAI Review",
        contributorAvatar: "DR",
        summary: "Full evaluation report submitted",
        status: "Accepted",
        submittedAt: "Apr 25, 2026",
      },
    ],
  },
  {
    id: 9,
    title: "Create Pediatric Dosage Calculator",
    description:
      "Build a clinical decision support tool for pediatric drug dosing based on weight, age, and renal function.",
    fullDescription:
      "Develop a clinical decision support tool that calculates pediatric drug dosages using patient weight, age, body surface area, and renal function (eGFR). Should cover 200+ commonly prescribed pediatric medications with dosing references from Lexicomp and WHO guidelines. Must include safety checks for maximum doses and drug interactions.",
    type: "P2P",
    reward: 800,
    status: "Open",
    submissions: 1,
    deadline: "May 22, 2026",
    createdAt: "May 2, 2026",
    requester: "Children's Hospital Network",
    requesterAvatar: "CH",
    tags: ["Clinical Tool", "Pediatrics", "Calculator"],
    successCriteria:
      "Functional tool covering 200+ medications with accurate dosing, safety alerts, and citation of guidelines.",
    submissionsList: [
      {
        id: 14,
        contributor: "PharmTech",
        contributorAvatar: "PT",
        summary: "Calculator with 150 medications",
        status: "Pending",
        submittedAt: "May 6, 2026",
      },
    ],
  },
  {
    id: 10,
    title: "Integrate FHIR R4 for Clinics",
    description:
      "Develop FHIR R4 integration modules for seamless EHR data exchange between Aura and clinic systems.",
    fullDescription:
      "Create a FHIR R4 integration layer that enables bidirectional data exchange between the Aura platform and major EHR systems (Epic, Cerner, Meditech). Must support Patient, Observation, DiagnosticReport, MedicationRequest, and Encounter resources. Include OAuth2 authentication, rate limiting, and error handling.",
    type: "Foundation",
    reward: 2800,
    status: "Under Review",
    submissions: 3,
    deadline: "May 6, 2026",
    createdAt: "Apr 18, 2026",
    requester: "Aura Foundation",
    requesterAvatar: "AF",
    tags: ["FHIR", "Integration", "EHR"],
    successCriteria:
      "Working integration with Epic and Cerner supporting all required FHIR resources. Must pass interoperability tests and include documentation.",
    submissionsList: [
      {
        id: 15,
        contributor: "InteropHealth",
        contributorAvatar: "IH",
        summary: "Epic integration complete",
        status: "Pending",
        submittedAt: "Apr 28, 2026",
      },
    ],
  },
];
