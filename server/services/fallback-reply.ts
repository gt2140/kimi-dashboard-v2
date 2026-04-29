type FallbackReplyInput = {
  userMessage: string;
  agentName: string;
  allowedCategories: string[];
  accessibleFileCount: number;
};

type FallbackReply = {
  content: string;
  note: string | null;
};

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function isGreetingMessage(content: string) {
  const normalized = normalize(content.trim());
  return /^(hola|hello|hi|hey|buenas|buenos dias|buen dia|good morning)\b/.test(
    normalized
  );
}

function isCapabilityQuestion(content: string) {
  const normalized = normalize(content);
  return (
    normalized.includes("con que me podes ayudar") ||
    normalized.includes("en que me podes ayudar") ||
    normalized.includes("what can you help") ||
    normalized.includes("que podes hacer")
  );
}

function isDexaQuestion(content: string) {
  const normalized = normalize(content);
  return (
    normalized.includes("dexa") ||
    normalized.includes("body composition") ||
    normalized.includes("composicion corporal")
  );
}

function isMuscleGainNutritionQuestion(content: string) {
  const normalized = normalize(content);
  return (
    (normalized.includes("dieta") ||
      normalized.includes("nutrition") ||
      normalized.includes("meal") ||
      normalized.includes("comida")) &&
    (normalized.includes("musculo") ||
      normalized.includes("muscle") ||
      normalized.includes("aumentar de peso") ||
      normalized.includes("ganar peso") ||
      normalized.includes("5 kg"))
  );
}

function isSupplementsAndPeptidesQuestion(content: string) {
  const normalized = normalize(content);
  const mentionsIntervention =
    normalized.includes("suplement") ||
    normalized.includes("supplement") ||
    normalized.includes("peptid") ||
    normalized.includes("protocolo") ||
    normalized.includes("protocol");
  const mentionsGoal =
    normalized.includes("musculo") ||
    normalized.includes("muscle") ||
    normalized.includes("energia") ||
    normalized.includes("energy") ||
    normalized.includes("ganar peso") ||
    normalized.includes("aumentar de peso");

  return mentionsIntervention && mentionsGoal;
}

export function buildContextAwareFallbackReply(
  params: FallbackReplyInput
): FallbackReply {
  if (isGreetingMessage(params.userMessage)) {
    return {
      content: `Hola, soy ${params.agentName}. Puedo ayudarte a interpretar estudios, biomarcadores, composicion corporal, genetica y notas de salud. Si queres, decime tu objetivo y te doy una primera orientacion practica.`,
      note: null,
    };
  }

  if (isCapabilityQuestion(params.userMessage)) {
    return {
      content:
        "Puedo ayudarte a analizar bloodwork, composicion corporal, genetica, suplementos, nutricion y objetivos de rendimiento o salud. Incluso sin archivos puedo darte una primera orientacion practica; si despues compartis resultados o metricas, lo vuelvo mucho mas preciso y personalizado.",
      note: "Respuesta util sin contexto del vault todavia.",
    };
  }

  if (isMuscleGainNutritionQuestion(params.userMessage)) {
    return {
      content:
        "Aunque no tenga tus archivos todavia, te puedo dar una base util para ganar 5 kg de peso con foco en musculo: normalmente conviene un superavit moderado de 250 a 400 kcal por dia, proteina en torno a 1.6-2.2 g/kg, carbohidratos suficientes para entrenar fuerte y un monitoreo semanal del peso y la cintura para ajustar. Si queres, en el siguiente mensaje te armo una estrategia concreta de calorias, macros y estructura de comidas segun tu peso, altura y nivel de entrenamiento.",
      note: "Respuesta util sin contexto del vault todavia.",
    };
  }

  if (isSupplementsAndPeptidesQuestion(params.userMessage)) {
    return {
      content:
        "Si el objetivo es ganar musculo y sentir mas energia, puedo darte una base razonable aunque todavia no tenga tus estudios. A nivel suplementos, las combinaciones mas solidas suelen empezar por creatina monohidrato, proteina si no llegas a requerimientos, magnesio si dormis mal o estas muy cargado, y cafeina o una estrategia de pre-entreno bien medida si el problema principal es el rendimiento. A nivel peptidos, depende mucho del contexto: para recuperacion y tolerancia al volumen suelen aparecer BPC-157 o TB-500, mientras que para composicion corporal o eje hormonal ya entran decisiones bastante mas delicadas y no conviene recomendarlas a ciegas sin ver edad, entrenamiento, labs, presion, hematocrito, glucosa y hormonas. Si queres, puedo seguir con una respuesta mas libre y armarte un protocolo escalonado: 1) base de suplementos, 2) analitica que revisaria antes de peptidos, y 3) que combinaciones evitaria para no comprar cosas innecesarias ni arriesgarte al pedo. Para energia en particular, primero intentaria separar si el cuello de botella es sueño, calorias, hierro, tiroides, testosterona, estres o simplemente mala distribucion de carbohidratos alrededor del entrenamiento.",
      note: "Respuesta util sin contexto del vault todavia.",
    };
  }

  if (isDexaQuestion(params.userMessage)) {
    return {
      content:
        "Puedo ayudarte a leer un DEXA aunque todavia no hayas subido el archivo. En general miro masa magra total, porcentaje de grasa corporal, grasa troncal/visceral y asimetrias entre piernas y brazos. Si me pegas esos valores, te explico que significan, que estaria bien para tu objetivo y como usarlos para decidir volumen, definicion o mantenimiento.",
      note: "Respuesta util sin contexto del vault todavia.",
    };
  }

  if (params.accessibleFileCount === 0 && params.allowedCategories.length > 0) {
    return {
      content:
        "Puedo ayudarte con eso aunque todavia no tenga archivos cargados. Incluso sin estudios puedo darte una primera respuesta util si me decis el objetivo, el contexto y los datos que ya tengas. Por ejemplo, puedo ayudarte a ordenar prioridades, pensar riesgos, armar una estrategia inicial y decirte que metricas revisaria antes de avanzar. Si despues subis estudios o notas al vault, lo vuelvo mucho mas preciso y personalizado.",
      note: `Sin archivos de ${params.allowedCategories.join(", ")} disponibles todavia.`,
    };
  }

  return {
    content:
      "Puedo orientarte con eso. Contame el objetivo exacto, tus datos mas importantes o el contexto que ya tengas, y te doy una respuesta inicial clara y accionable. Si despues agregas estudios o notas, la personalizo mejor.",
    note: "Respuesta generada en modo limitado.",
  };
}
