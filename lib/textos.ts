/**
 * Los textos de la interfaz, en un solo lugar.
 *
 * Reglas, que salen de design-reference/sistema/voz-y-textos.md:
 *  - Castellano rioplatense con voseo. "Elegí", "armá", "entrás".
 *  - Como un colega, no como un sistema. Decí qué pasó, no qué falló.
 *  - Botones: un verbo y un objeto. Nunca "Aceptar", nunca "Enviar" solo.
 *  - Sin signos de exclamación salvo para confirmar que algo salió bien.
 *  - Nunca emojis.
 *
 * El vocabulario de abajo es la tabla de equivalencias de ese documento. Las
 * pantallas usan estas palabras y no las del modelo de datos: en la base un
 * grupo se llama `classroom` y una tarea `classroom_assignment`, y eso no tiene
 * por qué llegar a la pantalla. Más adelante el vocabulario puede variar según
 * el tipo de cuenta sin tocar un componente.
 *
 * Los bloques del rediseño van sumando secciones acá a medida que rehacen cada
 * pantalla. Las pantallas todavía no rediseñadas conservan sus textos viejos.
 */

export const VOCABULARIO = {
  /** No "programa de materia". */
  temario: 'temario',
  /** No "aula": suena institucional, y además se crea solo. */
  grupo: 'grupo',
  /** No "asignación". */
  tarea: 'tarea',
  /** No "ventana de disponibilidad". */
  desde: 'Desde',
  hasta: 'Hasta',
  /** No "diseño curricular". La jurisdicción no se muestra nunca. */
  planOficial: 'plan oficial de la provincia',
  /** No "perfil pedagógico". */
  comoDasLaMateria: 'cómo das la materia',
} as const

export const MARCA = {
  nombre: 'MaestrIA',
  /** Qué es, en una frase que entiende alguien que nunca la usó. */
  queEs:
    'El docente arma el temario y manda tareas. La IA le muestra a cada alumno en qué se equivoca antes de darle la respuesta.',
} as const

export const NAVEGACION = {
  etiquetaNav: 'Principal',
  alumno: { tareas: 'Mis tareas', practicar: 'Practicar', progreso: 'Mi progreso' },
  docente: { alumnos: 'Mis alumnos', materias: 'Mis materias', tareas: 'Mis tareas' },
  ingresar: 'Ingresar',
} as const

export const MODO = {
  aOscuro: 'Cambiar a modo oscuro',
  aClaro: 'Cambiar a modo claro',
} as const

export const ENTRADA = {
  titulo: '¿Cómo entrás?',
  bajada: 'Elegí una vez. Después lo podés cambiar desde tu perfil.',
  docente: { titulo: 'Soy docente', detalle: 'Armo temarios y mando tareas' },
  alumno: { titulo: 'Soy alumno', detalle: 'Practico y rindo mis tareas' },
  separador: 'o',
  codigo: {
    etiqueta: 'Tu profe te pasó un código',
    ejemplo: '7K4P2M',
    ir: 'Ir',
    irAccesible: 'Ir al grupo',
    incompleto: (largo: number) => `El código tiene ${largo} caracteres. Fijate si te falta alguno.`,
  },
} as const

export const INGRESO = {
  docente: {
    titulo: 'Entrá como docente',
    bajada: 'Con tu cuenta guardamos tus materias, tus alumnos y sus tareas.',
    volver: 'No soy docente: volver',
  },
  alumno: {
    titulo: 'Entrá como alumno',
    bajada: 'Con tu cuenta guardamos tus tareas y tu progreso.',
    volver: 'No soy alumno: volver',
    tengoCodigo: 'Tengo un código de mi profe: entrar sin cuenta',
  },
  /** Quien llega a /sign-in sin haber pasado por la entrada (un link viejo, el rebote del proxy). */
  sinRol: {
    titulo: 'Entrá a MaestrIA',
    bajada: 'Usá tu cuenta de Google. Si es tu primera vez, la cuenta se crea sola.',
    volver: 'Volver al inicio',
  },
  /** El rebote desde /practicar: decir por qué se pide la cuenta. */
  paraPracticar: 'Para practicar por tu cuenta necesitás una cuenta. Es gratis.',
  conGoogle: 'Continuar con Google',
  abriendoGoogle: 'Abriendo Google…',
} as const

export const BIENVENIDA = {
  guardando: 'Preparando tu cuenta…',
  noSeGuardo: 'No pudimos guardar tu elección. Probá de nuevo.',
} as const

export const GRUPO = {
  buscando: 'Buscando el grupo…',
  teInvito: (docente: string) => `Te invitó ${docente}`,
  bajadaInvitado: 'Entrás con tu nombre. No necesitás cuenta.',
  nombre: { etiqueta: '¿Cómo te llamás?', ejemplo: 'Nombre y apellido' },
  entrar: 'Entrar al grupo',
  entrarComo: (nombre: string) => `Entrar como ${nombre}`,
  entrando: 'Entrando…',
  yaTengoCuenta: 'Ya tengo cuenta: entrar con Google',
  codigoInvalido: 'Ese código no parece correcto. Tiene que tener 6 caracteres.',
  noEncontrado: 'No encontramos ningún grupo con ese código.',
  sinConexion: 'No pudimos conectarnos. Probá de nuevo en un momento.',
  noPudimosSumarte: 'No pudimos sumarte al grupo. Probá de nuevo.',
  volverAlInicio: 'Volver al inicio',
  /** K5: el docente ya sumó alumnos por nombre y todavía no entraron. */
  sosAlguno: '¿Sos alguno de estos?',
  sosAlgunoDetalle: 'Tu docente ya te sumó al grupo con tu nombre. Tocá el tuyo para entrar.',
  soyYo: (nombre: string) => `Soy ${nombre}`,
  soyOtraPersona: 'No, soy otra persona',
} as const

/** L0: en el seguimiento de un grupo, lo armado para un solo alumno. */
export const ASIGNACIONES_INDIVIDUALES = {
  titulo: 'Sólo para un alumno',
  detalle: 'Los diagnósticos que armaste desde la ficha de un alumno. No cuentan para el promedio del grupo ni para los pendientes.',
  para: (nombre: string) => `Para ${nombre}`,
  sinNombre: 'un alumno que todavía no entró',
  entregado: 'Entregado',
  pendiente: 'Pendiente',
} as const

export const INVITADO = {
  aviso: 'Estás entrando como invitado. Creá tu cuenta para no perder tu progreso.',
  conCuenta: 'Con tu cuenta también vas a poder practicar por tu cuenta y ver cómo te va en cada tema.',
  crearCuenta: 'Crear mi cuenta',
} as const

export const CUENTA = {
  abrirMenu: 'Abrir el menú de tu cuenta',
  /** H4: sólo para la lista de admin. */
  admin: { titulo: 'Administración', planes: 'Planes de los docentes', usoDeIA: 'Uso de la IA' },
  estasComo: { DOCENTE: 'Estás como docente', ALUMNO: 'Estás como alumno' },
  cerrarSesion: 'Cerrar sesión',
  /** Docente: mirar la app como la ve un alumno, sin dejar de ser docente. */
  verComoAlumno: 'Ver la vista de alumno',
  verComoAlumnoDetalle: 'Se abre en otra pestaña',
  vistaAlumno: {
    aviso: 'Estás viendo la vista de alumno. Tu cuenta sigue siendo de docente.',
    volver: 'Volver a mi panel',
  },
  cambiar: {
    aAlumno: {
      item: 'Cambiar mi cuenta a alumno',
      titulo: '¿Cambiar a la vista de alumno?',
      detalle: 'Vas a cambiar a la vista de alumno. Tus materias y alumnos siguen donde están.',
    },
    aDocente: {
      item: 'Cambiar mi cuenta a docente',
      titulo: '¿Cambiar a la vista de docente?',
      detalle: 'Vas a cambiar a la vista de docente. Tus tareas y tu progreso siguen donde están.',
    },
    confirmar: 'Cambiar de vista',
    cancelar: 'Quedarme acá',
    cambiando: 'Cambiando…',
    fallo: 'No pudimos cambiar tu cuenta. Probá de nuevo.',
  },
} as const

export const LEGALES = {
  terminos: 'Términos y condiciones',
  privacidad: 'Política de privacidad',
  /** `accion` completa "Al ___ aceptás…": "ingresar", "entrar al grupo". */
  aviso: (accion: string) => ({ antes: `Al ${accion} aceptás los `, medio: ' y la ', despues: '.' }),
} as const

export const PANEL_DOCENTE = {
  /** Sub-entradas de "Mis tareas" hasta que el bloque 3 parta el panel. */
  tareas: { guardadas: 'Tareas guardadas', armar: 'Armar tarea' },
  /** Lo que escucha un lector de pantalla mientras se ve el esqueleto. */
  cargando: {
    alumnos: 'Cargando tus alumnos…',
    materias: 'Cargando tus materias…',
    tareas: 'Cargando tus tareas…',
  },
} as const

export const ONBOARDING_DOCENTE = {
  etiqueta: 'Primeros pasos',
  progreso: (hechos: number, total: number) => `${hechos} de ${total} pasos`,
  hitos: {
    materia: 'Tu materia',
    temario: 'Tu temario',
    alumno: 'Tu primer alumno',
    tarea: 'Tu primera tarea',
  },
  hecho: 'Hecho',
  pendiente: 'Pendiente',
  materia: {
    titulo: 'Empecemos por tu materia',
    detalle: 'Decinos qué materia das y cargá el temario. Podés subir el archivo que ya tenés.',
    boton: 'Crear mi materia',
  },
  temario: {
    titulo: (materia: string) => `Cargá el temario de ${materia}`,
    detalle: 'Con el temario, MaestrIA sabe sobre qué preguntar. Podés subir el archivo o escribirlo.',
    boton: 'Cargar el temario',
  },
  alumno: {
    titulo: 'Sumá a tu primer alumno',
    detalle: 'Le pasás un link y entra con su nombre, sin crear una cuenta.',
    boton: 'Invitar a mi primer alumno',
    esperando: {
      titulo: 'Esperando a tu primer alumno',
      detalle: 'Cuando entre con el link, lo vas a ver en Mis alumnos.',
      boton: 'Ver el link de nuevo',
    },
    mientrasTanto: 'Mientras tanto, armar la tarea',
  },
  tarea: {
    titulo: 'Armá tu primera tarea',
    detalle: 'Elegís los temas y MaestrIA arma las preguntas. Las revisás antes de mandarlas.',
    boton: 'Armar la primera tarea',
    mandar: {
      titulo: 'Mandale la tarea a tu grupo',
      detalle: 'Ya la tenés armada. Elegila en tus tareas guardadas y mandásela.',
      boton: 'Mandar la tarea',
    },
  },
  listo: {
    titulo: 'Ya mandaste tu primera tarea.',
    detalle: 'Cuando tus alumnos la resuelvan, acá vas a ver en qué se equivoca cada uno.',
    boton: 'Cerrar este aviso',
  },
  link: {
    titulo: 'El link para tu alumno',
    detalle: (materia: string) => `Con este link entra al grupo de ${materia}. Sirve para todos tus alumnos de esa materia.`,
    preparando: 'Preparando el link…',
    etiquetaLink: 'Link del grupo',
    copiar: 'Copiar el link',
    copiado: 'Link copiado',
    recordatorio: 'Entra con su nombre. No necesita cuenta.',
    codigo: (codigo: string) => `También puede escribir el código ${codigo} en la pantalla de inicio.`,
    fallo: 'No pudimos preparar el link. Probá de nuevo.',
    reintentar: 'Probar de nuevo',
    noSeCopio: 'No pudimos copiarlo. Seleccioná el link y copialo a mano.',
  },
  queCargamos: 'tu progreso',
} as const

export const CAMINOS_TEMARIO = {
  titulo: '¿Cómo querés armar tu temario?',
  detalle: 'Elegí el camino que te quede más cómodo. Después lo podés editar.',
  queSigue: 'Qué pasa después',
  import: {
    titulo: 'Subir el archivo que ya tengo',
    para: 'Tenés el temario en PDF, Word o una foto.',
    despues: 'MaestrIA lo lee y arma las unidades por vos.',
    boton: 'Subir un archivo',
  },
  curriculum: {
    titulo: 'Usar el plan oficial de la provincia',
    para: 'Preferís partir de los contenidos oficiales.',
    despues: 'Cargamos los ejes y temas de tu nivel y año.',
    boton: 'Ver el plan oficial',
  },
  manual: {
    titulo: 'Escribirlo yo',
    para: 'Tenés tu propio recorte y lo querés a tu manera.',
    despues: 'Escribís las unidades a mano.',
    boton: 'Empezar en blanco',
  },
  masTarde: 'Decidir más tarde',
} as const

export const CHIP_TEMA = {
  dominado: 'Dominado',
  flojo: 'Flojo',
  sin_datos: 'Sin datos',
} as const

export const MIS_ALUMNOS = {
  titulo: 'Mis alumnos',
  agregar: 'Agregar alumno',
  agregarCorto: '+ Alumno',
  queCargamos: 'tus alumnos',
  vacio: {
    titulo: 'Todavía no agregaste alumnos',
    detalle: 'Cuando sumes al primero, acá vas a ver cómo le va: qué temas domina, cuáles le cuestan y cuándo practicó por última vez.',
  },
  sinMateria: {
    titulo: 'Primero armá tu materia',
    detalle: 'Para sumar alumnos necesitás al menos una materia con su temario.',
  },
  vista: { etiqueta: 'Cómo ver el listado', lista: 'Lista', planilla: 'Planilla' },
  todaviaNoEntro: 'Todavía no entró',
  verLink: 'Ver su link',
  quitar: (nombre: string) => `Quitar a ${nombre} del listado`,
  ultimaVez: 'Última práctica',
  verFicha: (nombre: string) => `Ver la ficha de ${nombre}`,
  sugerencia: {
    inactivo: (nombre: string, dias: number) => `${nombre} no practica hace ${dias} días`,
    conTema: (tema: string) => `Le sigue costando el tema ${tema}. ¿Le mandamos una tarea corta?`,
    sinTema: '¿Le mandamos una tarea corta para que retome?',
    leCuesta: (nombre: string, tema: string) => `A ${nombre} le cuesta el tema ${tema}`,
    reforzar: '¿Le mandamos una tarea corta para reforzarlo?',
    boton: 'Armar tarea',
  },
  resumen: {
    estaSemana: 'Esta semana',
    tareasEntregadas: (n: number) => (n === 1 ? 'tarea entregada' : 'tareas entregadas'),
    temaMasFlojo: 'Tema más flojo',
    deAlumnos: (n: number, total: number) => `${n} de ${total} ${total === 1 ? 'alumno' : 'alumnos'}`,
    sinTemaFlojo: 'Ninguno por ahora',
    sinTemaFlojoDetalle: 'Aparece cuando un tema le cuesta a alguien.',
  },
  planilla: {
    titulo: 'Planilla de alumnos',
    alumno: 'Alumno',
    prepara: 'Qué prepara',
    ultima: 'Última práctica',
    practicas: 'Prácticas',
    tareas: 'Tareas entregadas',
    aciertos: 'Aciertos',
    flojo: 'Tema más flojo',
    sinDato: 'Sin datos',
  },
  grupos: {
    titulo: 'Mis grupos',
    detalle: 'Códigos, tareas mandadas y seguimiento por grupo.',
    mostrar: 'Ver mis grupos',
    ocultar: 'Ocultar mis grupos',
  },
  /** J1: quitar alumnos sin borrar su historia. */
  quitarAlumno: {
    boton: 'Quitar de mis grupos',
    aria: (nombre: string) => `Quitar a ${nombre} de mis grupos`,
    titulo: (nombre: string) => `¿Quitar a ${nombre} de tus grupos?`,
    detalle: 'Deja de aparecer en tu listado y de ocupar un lugar en tu plan. No se borra nada de lo que respondió: si vuelve, vuelve con su historia.',
    confirmar: 'Quitar',
    quitando: 'Quitando…',
    cancelar: 'Cancelar',
    fallo: 'No se pudo quitar. Probá de nuevo.',
  },
  sinRespuestas: {
    boton: (n: number) => `Quitar a los que nunca respondieron (${n})`,
    titulo: (n: number) => (n === 1 ? '¿Quitar al alumno que nunca respondió?' : `¿Quitar a los ${n} alumnos que nunca respondieron?`),
    detalle: 'Entraron a tu grupo y no respondieron ninguna tarea ni práctica. No se borra nada: podés volver a sumarlos cuando quieras.',
    lista: 'Se quitan',
    confirmar: (n: number) => (n === 1 ? 'Quitar a 1 alumno' : `Quitar a ${n} alumnos`),
    /** K8: para confirmar el de uno. */
    ultimaActividad: (actividad: string) => `Última actividad en tus grupos: ${actividad}.`,
  },
  quitados: {
    titulo: (n: number) => `Quitados (${n})`,
    mostrar: (n: number) => `Ver quitados (${n})`,
    ocultar: 'Ocultar quitados',
    detalle: 'No ocupan lugar en tu plan. Si vuelven, vuelven con todo lo que respondieron.',
    volver: 'Volver a sumar',
    volverAria: (nombre: string) => `Volver a sumar a ${nombre}`,
    volviendo: 'Sumando…',
    quitadoEl: (fecha: string) => `Quitado el ${fecha}`,
    sinLugar: 'No tenés lugar en tu plan para sumarlo de nuevo.',
    fallo: 'No se pudo volver a sumar. Probá de nuevo.',
  },
} as const

export const AGREGAR_ALUMNO = {
  titulo: 'Agregar alumno',
  detalle: 'Escribí su nombre y te damos el link para pasarle. Entra con su nombre, sin crear una cuenta.',
  nombre: { etiqueta: 'Nombre y apellido', ejemplo: 'Sofía Ramírez' },
  contexto: {
    etiqueta: 'Qué prepara y para cuándo',
    ayuda: 'Opcional. Te ayuda a ubicarlo en el listado.',
    ejemplo: 'Análisis I · rinde el 12/12',
  },
  materia: { etiqueta: 'Materia' },
  boton: 'Agregar alumno',
  agregando: 'Agregando…',
  fallo: 'No pudimos agregarlo. Probá de nuevo.',
  listo: {
    titulo: (nombre: string) => `Listo. Pasale este link a ${nombre}`,
    detalle: 'Hasta que entre, lo vas a ver en el listado como "Todavía no entró".',
    cerrar: 'Volver al listado',
  },
} as const

export const FICHA_ALUMNO = {
  volver: 'Volver a Mis alumnos',
  queCargamos: 'la ficha',
  noEsTuAlumno: 'Ese alumno no está en tus grupos.',
  sinCuenta: 'Entra con su nombre, sin cuenta',
  ultimaPractica: (cuando: string) => `Última práctica: ${cuando}`,
  nuncaPractico: 'Todavía no practicó',
  contexto: {
    etiqueta: 'Qué prepara y para cuándo',
    ejemplo: 'Análisis I · rinde el 12/12',
    guardar: 'Guardar',
    guardando: 'Guardando…',
    guardado: 'Guardado',
    fallo: 'No se pudo guardar. Probá de nuevo.',
  },
  asignar: 'Asignarle una tarea',
  temas: {
    titulo: 'Cómo le va en cada tema',
    /** Los dos números salen de `lib/alumnos-docente.ts`: el texto no puede decir otra cosa que la regla. */
    detalle: (paraFlojo: number, paraDominado: number) =>
      `Sobre lo que respondió en tus tareas y prácticas. Con menos de ${paraFlojo} respuestas un tema todavía no tiene datos, y para darlo por dominado hacen falta ${paraDominado}.`,
    vacio: 'Todavía no respondió nada. Cuando resuelva su primera tarea, acá vas a ver tema por tema.',
    aciertos: (correctas: number, calificadas: number) => `${correctas} de ${calificadas} bien`,
    porcentaje: (p: number) => `${p} %`,
    grafico: 'Aciertos por tema',
  },
  errores: {
    titulo: 'Errores que se le repiten',
    detalle: 'Lo que detectó MaestrIA en sus respuestas. Habla del razonamiento, no de la nota.',
    vacio: 'Todavía no detectamos ninguno.',
  },
  planilla: {
    titulo: 'Sus prácticas',
    detalle: 'Las últimas 50, de la más reciente a la más vieja.',
    vacio: 'Todavía no hizo ninguna.',
    fecha: 'Fecha',
    que: 'Tarea o práctica',
    temas: 'Temas',
    resultado: 'Resultado',
    practicaLibre: 'Práctica libre',
    sinCalificar: (n: number) => `${n} sin calificar`,
    masTemas: (n: number) => (n === 1 ? 'y 1 tema más' : `y ${n} temas más`),
  },
} as const

/** J2: la ficha del alumno, por secciones. Todo opcional salvo el nombre. */
export const FICHA_PEDAGOGICA = {
  titulo: 'Ficha',
  detalle: 'Completá lo que sepas. Nada es obligatorio salvo el nombre, y lo podés cambiar cuando quieras.',
  queCargamos: 'la ficha',
  secciones: {
    alumno: 'El alumno',
    donde: 'Dónde estudia',
    rinde: 'Qué rinde',
    evalua: 'Cómo lo evalúan',
    cuesta: 'Qué le cuesta',
    observaciones: 'Observaciones',
  },
  campos: {
    nombre: { etiqueta: 'Nombre y apellido', ayuda: 'Corregilo si entró con otro nombre.' },
    edad: { etiqueta: 'Edad' },
    contacto: { etiqueta: 'Contacto', ejemplo: 'Teléfono o mail' },
    responsable: { etiqueta: 'Adulto responsable', ejemplo: 'Nombre y teléfono', ayuda: 'Porque es menor de 18.' },
    institucion: { etiqueta: 'Institución', ejemplo: 'Colegio, instituto o universidad' },
    anioCursa: { etiqueta: 'Año que cursa', ejemplo: '3er año, 1er año de la carrera' },
    orientacion: { etiqueta: 'Orientación', ejemplo: 'Técnica en electrónica, bachiller en economía' },
    materia: { etiqueta: 'Materia', ninguna: 'Sin elegir', ayuda: 'Una de Mis materias.' },
    fechaExamen: { etiqueta: 'Fecha del examen o de la mesa' },
    comoEvalua: {
      etiqueta: 'Cómo toma examen su profesor',
      ejemplo: 'Su profe toma 4 ejercicios de desarrollo, sin calculadora, uno de demostración',
    },
    observaciones: { etiqueta: 'Observaciones', ejemplo: 'Lo que quieras recordar de este alumno' },
  },
  cuesta: {
    sinMateria: 'Elegí la materia en "Qué rinde" para marcar los temas que le cuestan.',
    sinTemas: 'Esa materia todavía no tiene temas cargados.',
    marcados: (n: number) => (n === 1 ? '1 tema marcado' : `${n} temas marcados`),
  },
  privacidad: 'Para armarle tareas y diagnósticos, MaestrIA usa la edad, el año, la orientación, cómo lo evalúan y lo que le cuesta. Nunca el nombre, el contacto, el responsable ni la institución.',
  guardar: 'Guardar la ficha',
  guardando: 'Guardando…',
  guardado: 'Guardado',
  fallo: 'No se pudo guardar. Probá de nuevo.',
  sinNombre: 'El nombre no puede quedar vacío.',
  todaviaNoEntro: 'Todavía no entró',
  pasaleElLink: 'Cuando entre con este link, la ficha pasa a ser suya.',
  verLink: 'Ver su link',
  rinde: { hoy: 'Rinde hoy', manana: 'Rinde mañana', en: (dias: number) => `Rinde en ${dias} días` },
} as const

/** J4 a J7: el diagnóstico inicial. */
export const DIAGNOSTICO = {
  titulo: 'Diagnóstico',
  detalle: 'Para saber dónde está antes de empezar: una o dos preguntas por tema, sin ayuda y sin ver si acertó hasta el final.',
  armar: 'Armar diagnóstico',
  armarOtro: 'Armar otro diagnóstico',
  vacio: 'Todavía no le armaste un diagnóstico.',
  /** L0: sin la migración 028 no se puede guardar que un diagnóstico es sólo para un alumno. */
  faltaActualizacion: 'Falta una actualización de la base para armar diagnósticos individuales',
  dialogo: {
    titulo: 'Armar diagnóstico',
    // K6: la etiqueta puede terminar en punto ("Matemática · 3.º Sec."): no se duplica.
    detalle: (materia: string) =>
      `Sobre el programa de ${materia.replace(/\.$/, '')}. Lo ve sólo este alumno, con un intento por cuestionario.`,
    modo: 'Cómo lo querés',
    porUnidad: { titulo: 'Por unidad', detalle: 'Un cuestionario por unidad. Se pueden rendir en días distintos.' },
    integral: { titulo: 'Integral', detalle: 'Un solo examen con todo el programa, hasta 40 preguntas.' },
    unidades: 'Unidades que entran',
    unidadesAyuda: 'Destildá las que todavía no vio.',
    temas: (n: number) => (n === 1 ? '1 tema' : `${n} temas`),
    resumen: (cuestionarios: number, preguntas: number, minutos: number) =>
      `${cuestionarios === 1 ? '1 cuestionario' : `${cuestionarios} cuestionarios`} · ${preguntas} preguntas · unos ${minutos} minutos en total`,
    nada: 'Elegí al menos una unidad con temas.',
    tipos: 'Sobre todo opción múltiple y numéricas, de dificultad pareja y sin pistas.',
    generar: 'Generar y asignar',
    cancelar: 'Cancelar',
    generando: (n: number, total: number) => `Generando ${n} de ${total}…`,
    /** L1: ya quedó guardado; no hace falta un botón de guardar. Sin nombre, es del grupo. */
    listo: (nombre: string | null) =>
      nombre ? `Listo. Quedaron guardados en la ficha y asignados a ${nombre}.` : 'Listo. Quedaron guardados y asignados al grupo.',
    listoDetalle: 'Un intento por cuestionario. Antes de que lo rinda, podés revisar y editar cada uno.',
    fallaron: (n: number) => (n === 1 ? 'Un cuestionario no se pudo generar.' : `${n} cuestionarios no se pudieron generar.`),
    reintentar: 'Reintentar los que fallaron',
    cerrar: 'Cerrar',
    fallo: 'No se pudo armar el diagnóstico. Probá de nuevo.',
  },
  armado: (fecha: string, modo: 'por_unidad' | 'integral') => `${modo === 'integral' ? 'Integral' : 'Por unidad'}, armado el ${fecha}`,
  preguntas: (n: number) => (n === 1 ? '1 pregunta' : `${n} preguntas`),
  /** J6: el resultado. */
  resultado: {
    porUnidad: 'Por unidad',
    porTema: 'Por tema',
    unidad: (nombre: string, bien: number, total: number) => `${nombre} — ${bien} de ${total}`,
    estado: { acerto: 'Acertó', fallo: 'Falló', no_respondio: 'No respondió' },
    deTema: (bien: number, total: number) => (total > 1 ? `${bien} de ${total}` : ''),
    errorDetectado: 'Lo que detectó MaestrIA:',
    noRindio: 'Todavía no lo rindió',
    enLaApp: (fecha: string) => `Rendido en la app el ${fecha}`,
    impreso: (fecha: string) => `Cargado del impreso el ${fecha}`,
    sinResultados: 'Cuando lo rinda (en la app o en papel), acá vas a ver tema por tema dónde está.',
    nota: 'Una foto del punto de partida: no usa los umbrales de "Cómo le va en cada tema".',
    marcar: (n: number) => (n === 1 ? 'Marcar el tema que falló como tema que le cuesta' : `Marcar los ${n} temas que falló como temas que le cuestan`),
    marcarTitulo: '¿Sumarlos a "Qué le cuesta"?',
    marcarDetalle: 'Se suman a los temas que ya tenía marcados en su ficha. Después los podés destildar.',
    marcarConfirmar: 'Sumarlos',
    marcando: 'Sumando…',
    marcados: 'Listo, quedaron en su ficha.',
    marcarFallo: 'No se pudieron sumar. Probá de nuevo.',
    cancelar: 'Cancelar',
  },
  /** J7: la versión en papel y la carga a mano. */
  impreso: {
    imprimir: 'Imprimir',
    imprimirAria: (titulo: string) => `Imprimir ${titulo}`,
    cargar: 'Cargar resultados del impreso',
    cargarAria: (titulo: string) => `Cargar los resultados de ${titulo} desde el papel`,
    queCargamos: 'el cuestionario',
    volver: 'Volver a la ficha',
    imprimirAhora: 'Imprimir o guardar en PDF',
    ayudaImprimir: 'Salen dos hojas: la del alumno, sin respuestas, y la tuya con las correctas, en una página aparte.',
    alumno: 'Alumno',
    fecha: 'Fecha',
    respuesta: 'Respuesta:',
    hojaDocente: 'Hoja del docente — respuestas correctas',
    noEntregar: 'No entregar al alumno.',
    verdaderoFalso: 'Verdadero / Falso',
    cargaTitulo: 'Cargar resultados del impreso',
    cargaDetalle: 'Marcá cada pregunta como la corregiste en papel. Lo que no marques queda como sin responder.',
    cargaNota: 'Esto queda sólo en el resultado del diagnóstico: no suma a "Cómo le va en cada tema", porque no hay una respuesta para analizar el error.',
    marcas: { bien: 'Bien', mal: 'Mal', sin_responder: 'Sin responder' },
    pregunta: (n: number) => `Pregunta ${n}`,
    correcta: 'Correcta:',
    guardar: 'Guardar resultados',
    guardando: 'Guardando…',
    guardado: 'Guardado. Ya se ve en la ficha.',
    fallo: 'No se pudo guardar. Probá de nuevo.',
    resumen: (bien: number, mal: number, sin: number) => `${bien} bien · ${mal} mal · ${sin} sin responder`,
  },
  /** J5: del lado del alumno. */
  alumno: {
    titulo: 'Diagnóstico',
    aviso: 'Esto es un diagnóstico: respondé lo que sepas, sin ayuda. Al final ves cómo te fue.',
    empezar: 'Empezar',
    siguiente: 'Siguiente',
    terminar: 'Terminar',
    guardando: 'Guardando tu respuesta',
    etiqueta: 'Diagnóstico',
  },
} as const

export const WIZARD_TEMARIO = {
  tituloCrear: 'Crear materia',
  tituloEditar: 'Editar materia',
  detalle: 'Armá el temario de tu materia: subí el archivo que ya tenés, partí del plan oficial o escribilo.',
  pasos: { 1: 'Nivel y año', 2: 'Materia', 3: 'Temario', 4: 'Cómo das la materia' },
  pasoListo: 'listo',
  leidoDelArchivo: 'Esto lo leímos de tu archivo. Confirmalo o cambialo.',
  cancelar: 'Cancelar',
  atras: 'Atrás',
  continuar: 'Continuar',
  guardar: 'Guardar cambios',
  crear: 'Crear materia',
} as const

export const LECTURA_DE_ARCHIVO = {
  boton: 'Leer el archivo',
  subiendo: 'Subiendo el archivo…',
  leyendo: 'Leyendo el archivo…',
  leido: 'Ya lo leí. Busco dónde están los contenidos.',
  /** I1: una imagen o un escaneo van enteros al modelo, y tardan más. */
  leyendoConIA: 'Es una imagen: la estoy leyendo con IA…',
  ordenando: 'Separando las unidades y sus temas…',
  listo: (unidades: number, temas: number) =>
    `Listo: ${unidades} ${unidades === 1 ? 'unidad' : 'unidades'} y ${temas} ${temas === 1 ? 'tema' : 'temas'}. Revisalos abajo.`,
  fallo: 'No pudimos leer el archivo. Probá con otro.',
  progreso: 'Qué está pasando con tu archivo',
  /** I4: los otros dos caminos, ofrecidos ahí mismo cuando la lectura falla. */
  alternativas: { escribirlo: 'Escribirlo yo', planOficial: 'Usar el plan oficial' },
} as const

export const COMPARTIR_TAREA = {
  mandar: {
    titulo: 'Mandar la tarea',
    detalle: (materia: string) => `Va para tu grupo de ${materia}. Después te damos el link y un mensaje para pasarles.`,
    preparando: 'Preparando el grupo…',
    grupo: 'A qué grupo',
    alumnos: (n: number) => (n === 1 ? '1 alumno' : `${n} alumnos`),
    opciones: { mostrar: 'Poner fechas o límite de intentos', ocultar: 'Sin fechas ni límite' },
    desde: 'Desde',
    hasta: 'Hasta',
    intentos: 'Cuántas veces la pueden hacer',
    intentosAyuda: 'Vacío: las veces que quieran.',
    boton: 'Mandar la tarea',
    mandando: 'Mandando…',
    fallo: 'No pudimos mandarla. Probá de nuevo.',
    intentosInvalidos: 'Tiene que ser un número mayor que cero.',
    moodle: 'Exportar para Moodle',
    exportando: 'Exportando…',
  },
  lista: {
    titulo: 'La tarea ya está en el grupo.',
    detalle: 'Pasales el link para que entren. Quien ya está en el grupo la ve en Mis tareas.',
    link: 'Link del grupo',
    copiarLink: 'Copiar el link',
    linkCopiado: 'Link copiado',
    mensaje: 'Mensaje para WhatsApp',
    mensajeAyuda: 'Lo podés editar antes de mandarlo.',
    copiarMensaje: 'Copiar el mensaje',
    mensajeCopiado: 'Mensaje copiado',
    abrirWhatsApp: 'Abrir WhatsApp',
    recordatorio: 'Tu alumno entra con su nombre. No necesita cuenta.',
    noSeCopio: 'No pudimos copiarlo. Seleccioná el texto y copialo a mano.',
    cerrar: 'Cerrar',
  },
} as const

export const MIS_TAREAS = {
  titulo: 'Mis tareas',
  filtro: 'Filtrar por materia',
  todas: 'Todas las materias',
  guardadas: (n: number) => `Guardadas (${n})`,
  hechas: (n: number) => `Las que probé yo (${n})`,
  /** Mientras se lee: sin número. "(0)" sería afirmar algo que todavía no se sabe. */
  guardadasSinContar: 'Guardadas',
  hechasSinContar: 'Las que probé yo',
  masTemas: (n: number) => (n === 1 ? 'y 1 tema más' : `y ${n} temas más`),
  sinHechas: 'Todavía no probaste ninguna.',
  vacio: {
    titulo: 'Todavía no armaste ninguna tarea',
    detalle: 'Elegís los temas y MaestrIA arma las preguntas. Las revisás antes de mandarlas.',
  },
  preguntas: (n: number) => (n === 1 ? '1 pregunta' : `${n} preguntas`),
  modo: { teorico: 'Teórica', practico: 'Práctica', mixto: 'Teórica y práctica' },
  mandar: 'Mandar a mi grupo',
  revisar: 'Revisar y editar',
  verComoAlumno: 'Ver como alumno',
  probar: 'Probarla yo',
  moodle: 'Exportar a Moodle',
  exportando: 'Exportando…',
  borrar: 'Borrar tarea',
  confirmarBorrado: 'Sí, borrarla',
  noBorrar: 'No borrar',
  nota: (nota: string) => `Nota ${nota}`,
  /** L1: los cuestionarios del diagnóstico, marcados y filtrables. */
  diagnostico: 'Diagnóstico',
  tipos: { etiqueta: 'Qué mostrar', todas: 'Todas', tarea: 'Tareas', diagnostico: 'Diagnósticos' },
  sinDelTipo: 'No hay ninguna de este tipo con este filtro.',
} as const

/** L1: las acciones de un cuestionario del diagnóstico, en la ficha y al terminar de armarlo. */
export const ACCIONES_DE_CUESTIONARIO = {
  nombre: {
    revisar: 'Revisar y editar',
    verComoAlumno: 'Ver como alumno',
    hacerlo: 'Hacerlo yo',
    imprimir: 'Imprimir',
    cargar: 'Cargar resultados del impreso',
  },
  aria: {
    revisar: (titulo: string) => `Revisar y editar ${titulo}`,
    verComoAlumno: (titulo: string) => `Ver ${titulo} como alumno`,
    hacerlo: (titulo: string) => `Hacer ${titulo} vos`,
    imprimir: (titulo: string) => `Imprimir ${titulo}`,
    cargar: (titulo: string) => `Cargar los resultados de ${titulo} desde el papel`,
  },
  menu: (titulo: string) => `Qué hacer con ${titulo}`,
  noSeAbrio: 'No se pudo abrir el cuestionario',
} as const

/** L1: la ruta que monta la revisión de una tarea fuera de Mis tareas. */
export const REVISAR_TAREA = {
  cargando: 'Buscando la tarea…',
  queCargamos: 'la tarea',
} as const

/** L5: cuántas preguntas y cuánto tiempo lleva una tarea. Los minutos salen de minutosEstimados (lib/diagnostico.ts). */
export const TAMANO_DE_TAREA = (preguntas: number, minutos: number) =>
  `${preguntas === 1 ? '1 pregunta' : `${preguntas} preguntas`} · unos ${minutos} min`

/** L3: la barra de símbolos debajo de una respuesta escrita. */
export const TECLADO_MATEMATICO = {
  etiqueta: 'Símbolos matemáticos',
  vistaPrevia: 'Se ve así:',
  nombres: {
    producto: 'Por (producto)',
    potencia: 'Potencia: escribí después el exponente',
    raiz: 'Raíz: escribí adentro el radicando',
    fraccion: 'Fracción',
    parentesis: 'Paréntesis',
    pi: 'Pi',
    menos: 'Menos',
    menorIgual: 'Menor o igual',
    mayorIgual: 'Mayor o igual',
    distinto: 'Distinto',
  },
  /** Para una factorización. */
  factorizacion: {
    placeholder: 'Tu respuesta (como 2^2·3·5)',
    ayuda: 'Escribí el producto de primos: · o x entre los factores y ^ para las potencias, por ejemplo 2^2·3·5.',
    leimos: 'Leímos:',
  },
  editor: {
    factorizacion: 'Se responde como producto de primos (por ejemplo 2^2·3·5), no con el número',
  },
} as const

/** L2: los atajos de teclado del cuestionario, en escritorio. */
export const ATAJOS = {
  pista: '↑↓ elegir · Espacio marcar · Enter siguiente · ? atajos',
  ocultar: 'Ocultar',
  ayudaTitulo: 'Atajos de teclado',
  cerrarAyuda: 'Cerrar',
  opciones: 'Opciones',
  lista: [
    ['↑ ↓', 'Moverte entre las opciones'],
    ['Espacio', 'Elegir la opción en la que estás'],
    ['1 a 9, A a D', 'Elegir esa opción'],
    ['V, F', 'Verdadero o falso'],
    ['Enter', 'Confirmar, o pasar a la siguiente'],
    ['← →', 'Pregunta anterior o siguiente, cuando se puede'],
    ['?', 'Mostrar u ocultar esta ayuda'],
    ['Esc', 'Salir del cuestionario'],
  ] as const,
  salir: {
    titulo: '¿Salís del cuestionario?',
    detalle: 'Se pierde lo que respondiste hasta ahora.',
    confirmar: 'Salir',
    quedarme: 'Seguir respondiendo',
  },
} as const

export const MIS_TAREAS_ALUMNO = {
  titulo: 'Mis tareas',
  cargando: 'Buscando tus tareas…',
  queCargamos: 'tus tareas',
  sinGrupo: {
    titulo: 'Todavía no estás en ningún grupo',
    detalle: 'Pedile el código a tu profe y escribilo acá abajo. Cuando te mande una tarea, la vas a ver en esta pantalla.',
  },
  sinTareas: {
    titulo: 'Tu profe todavía no te mandó ninguna tarea',
    detalle: 'Cuando te mande una, aparece acá con la fecha. Mientras tanto podés practicar el temario de tu grupo.',
  },
  empezar: 'Empezar tarea',
  volverAHacer: 'Volver a hacerla',
  desde: (fecha: string) => `desde el ${fecha}`,
  hasta: (fecha: string) => `hasta el ${fecha}`,
  intentos: (hechos: number, maximo: number | null) =>
    maximo ? `${hechos} de ${maximo} ${maximo === 1 ? 'intento' : 'intentos'}` : hechos === 0 ? 'sin empezar' : `la hiciste ${hechos} ${hechos === 1 ? 'vez' : 'veces'}`,
  mejorNota: (nota: string) => `tu mejor nota: ${nota}`,
  accesos: {
    etiqueta: 'Qué más podés hacer',
    practicar: { titulo: 'Practicar', detalle: 'Elegí la materia y los temas, y practicá por tu cuenta.' },
    progreso: { titulo: 'Mi progreso', detalle: 'Cómo te va en cada tema, lo que hiciste y tus tips.' },
  },
  grupos: {
    titulo: 'Mis grupos',
    teInvito: (docente: string) => `Te invitó ${docente}`,
    cerrado: 'Tu profe cerró este grupo.',
    practicar: 'Practicar este temario',
    cerrarPractica: 'Cerrar la práctica',
    practicaDetalle: 'Elegí los temas y MaestrIA te arma preguntas con el temario de tu profe.',
    practicaConCuenta: 'Con tu cuenta también vas a poder practicar este temario por tu cuenta.',
    queVe: (docente: string) =>
      `${docente} ve tu nombre, cómo te fue en lo que hacés en este grupo y los temas que te cuestan. Lo que practicás por tu cuenta es sólo tuyo.`,
  },
  sumarme: { etiqueta: 'Sumarme a otro grupo con un código', ejemplo: '7K4P2M', boton: 'Entrar al grupo' },
} as const

export const MI_PROGRESO = {
  titulo: 'Mi progreso',
  detalle: 'Lo que hiciste, los temas que te conviene reforzar y tus tips.',
  pestanas: {
    historial: 'Lo que hice',
    reforzar: (n: number) => (n > 0 ? `A reforzar (${n})` : 'A reforzar'),
    tips: 'Mis tips',
  },
  tips: {
    cargando: 'Buscando tus tips…',
    queCargamos: 'tus tips',
    vacio: {
      titulo: 'Todavía no tenés tips',
      detalle: 'Cuando te equivoques y pidas que te lo expliquen, MaestrIA guarda acá la idea clave para que la repases antes de rendir.',
    },
    resumenTitulo: 'Mis tips',
    verTodos: 'Ver todos',
  },
} as const

export const ONBOARDING_ALUMNO = {
  paso: (actual: number, total: number) => `${actual} de ${total}`,
  seguir: 'Seguir',
  volver: 'Volver',
  queEs: {
    titulo: 'Acá hacés las tareas que te manda tu profe',
    detalle:
      'Cuando te equivocás, MaestrIA no te da la respuesta de una: primero te muestra en qué te confundiste, para que la próxima te salga.',
  },
  grupo: {
    titulo: '¿Tu profe te pasó un código?',
    detalle: 'Con el código entrás a su grupo. Si te mandó un link, es lo mismo: abrilo y listo.',
    etiqueta: 'Código del grupo',
    ejemplo: '7K4P2M',
    incompleto: (largo: number) => `El código tiene ${largo} caracteres. Fijate si te falta alguno.`,
    entrar: 'Entrar al grupo',
    sinCodigo: 'Todavía no tengo código',
    yaEstas: {
      titulo: 'Ya estás en el grupo de tu profe',
      detalle: 'Si otro profe te pasa un código, lo escribís en Mis tareas.',
    },
  },
  tareas: {
    titulo: 'Todo lo que te manden aparece en Mis tareas',
    detalle: 'Con la fecha de entrega al lado. Y en Mi progreso ves cómo te va en cada tema.',
    boton: 'Ir a mis tareas',
  },
} as const

/** "1 unidad", "3 unidades": el número con el sustantivo en singular o plural. */
export function contar(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`
}

/**
 * Planes y cobro (tanda G). Sin signos de admiración, sin "¡Bienvenido!": la
 * voz de design-reference/sistema/voz-y-textos.md.
 */
export const PLAN = {
  /**
   * G2 y H3: dos textos. Al docente que ya usaba MaestrIA se le cuenta que
   * cambió; al que llega nuevo, que no vio la versión anterior, no se le habla
   * de un rediseño. Los números (días, alumnos de la prueba, alumnos gratis)
   * llegan de lib/planes.ts y de las variables de entorno.
   */
  avisoDePrueba: {
    existente: {
      titulo: 'Rediseñamos MaestrIA.',
      detalle: (dias: number, cupoPrueba: number, cupoGratis: number) =>
        `Desde hoy tenés ${dias} días para probarla completa, con hasta ${cupoPrueba} alumnos. Después podés seguir gratis con hasta ${cupoGratis}.`,
      lista: 'Qué hay de nuevo',
    },
    nuevo: {
      titulo: (dias: number, cupoPrueba: number) =>
        `Tenés ${dias} días para probar MaestrIA completa, con hasta ${cupoPrueba} alumnos.`,
      detalle: (cupoGratis: number) => `Sin tarjeta. Después podés seguir gratis con hasta ${cupoGratis}.`,
      lista: 'Lo que vas a encontrar',
    },
    novedades: [
      'Mis alumnos: cada alumno en una fila, con los temas donde se equivoca y cuándo practicó por última vez.',
      'El temario se arma en cuatro pasos: subís el archivo que ya tenés, partís del plan oficial o lo escribís.',
      'Cada tarea sale con el link del grupo y un mensaje listo para pasarles.',
    ],
    boton: (dias: number) => `Empezar los ${dias} días`,
  },
  opciones: {
    mensual: 'Por mes',
    mensualDetalle: '30 días desde que se acredita el pago.',
    pase: 'Pase de 90 días',
    paseDetalle: '90 días desde que se acredita el pago.',
    pagarMensual: 'Pagar el mes',
    pagarPase: 'Pagar el pase',
    ahorro: (monto: string) => `Ahorrás ${monto} frente a tres meses.`,
    nivel: (nivel: number) => (nivel === 5 ? 'Tope' : nivel === 1 ? '1 bloque' : `${nivel} bloques`),
    cupo: (cupo: number) => `Hasta ${cupo} alumnos`,
    acreditacion: 'El pago se acredita a mano, en el día. Tus alumnos y tus datos no se tocan mientras tanto.',
    sinPago: 'Todavía no se puede pagar este plan en línea.',
  },
  limite: {
    titulo: (alumnos: number, cupo: number) => `Tenés ${alumnos} de ${cupo} alumnos`,
    detalle: (nivel: number) =>
      `Para sumar a uno más pasá a ${nivel === 5 ? 'el tope, de hasta 150 alumnos' : nombreDeNivel(nivel)}. Pagás una clase por cada cinco alumnos que seguís.`,
    /** H7: el docente en el plan gratis quiere sumar al que no entra. */
    detalleGratis: (cupo: number, nivel: number, cupoDelNivel: number) =>
      `El plan gratis llega hasta ${cupo} alumnos. Para sumar a uno más pasá a ${nombreDeNivel(nivel)}: son ${cupoDelNivel} alumnos en total, no se suman a los ${cupo} gratis.`,
    /** H7: el tope de cuestionarios del gratis. */
    tituloCuestionarios: (generados: number, tope: number) => `Generaste ${generados} de ${tope} cuestionarios`,
    detalleCuestionarios: (tope: number, nivel: number | null) =>
      `El plan gratis genera hasta ${tope} cuestionarios cada 30 días.${nivel === null ? '' : ` Con ${nombreDeNivel(nivel)} generás sin ese tope.`}`,
    vencido: (cupoGratis: number) =>
      `Tu plan venció, así que por ahora no se puede generar ni sumar alumnos. Con ${cupoGratis} alumnos o menos, seguís gratis.`,
    sinNivel: 'Llegaste al tope de 150 alumnos.',
    volver: 'Volver',
  },
  vencimiento: {
    banner: (dias: number, esPrueba: boolean) =>
      esPrueba
        ? `Te ${dias <= 1 ? 'queda 1 día' : `quedan ${dias} días`} de prueba.`
        : `Tu plan termina ${dias <= 1 ? 'mañana' : `en ${dias} días`}.`,
    /** H7: lo que pasa después depende de cuántos alumnos tiene. */
    despuesGratis: (cupo: number) => `Después seguís gratis con hasta ${cupo} alumnos.`,
    despuesPlan: (alumnos: number, esPrueba: boolean) =>
      `Después, con ${alumnos} alumnos, ${esPrueba ? 'necesitás un plan' : 'necesitás renovarlo'}.`,
    mirarPrecios: 'Mirá los precios.',
    verPlanes: 'Ver planes',
    planesTitulo: 'Elegí cómo seguir',
    tituloPrueba: 'Terminó tu prueba de 30 días',
    tituloPlan: 'Tu plan venció',
    detalle: (fecha: string) => `Venció el ${fecha}. Nada se borró.`,
    /** H7: por qué está en solo lectura y cómo volver al gratis sin pagar. */
    detalleGratis: (alumnos: number, cupo: number) =>
      `Tenés ${alumnos} alumnos y el plan gratis llega hasta ${cupo}. Elegí un plan, o quitá alumnos hasta quedar en ${cupo} y seguís gratis.`,
    podes: 'Podés seguir',
    puede: (cupo: number) => [
      'Viendo tus materias, tus grupos y tus tareas.',
      'Viendo cómo le va a cada alumno.',
      'Tus alumnos responden las tareas que ya les mandaste.',
      `Quitando alumnos: con ${cupo} o menos, volvés al plan gratis.`,
    ],
    noPodes: 'Para esto hace falta un plan',
    noPuede: ['Generar cuestionarios.', 'Crear materias o grupos.', 'Sumar alumnos.'],
  },
  /** G6: el contador discreto de arriba del panel. */
  contador: {
    alumnos: (alumnos: number, cupo: number) => `${alumnos} de ${cupo} alumnos`,
    gratis: 'plan gratis',
    prueba: (dias: number | null) =>
      dias === null ? 'prueba' : `prueba, ${dias <= 1 ? 'queda 1 día' : `quedan ${dias} días`}`,
    vence: (fecha: string) => `tu plan vence el ${fecha}`,
    vencio: (fecha: string) => `tu plan venció el ${fecha}`,
    pruebaTermino: (fecha: string) => `tu prueba terminó el ${fecha}`,
    soloAlumnos: (alumnos: number) => (alumnos === 1 ? '1 alumno' : `${alumnos} alumnos`),
  },
} as const

/** "1 bloque", "3 bloques", "el tope". */
function nombreDeNivel(nivel: number): string {
  return nivel === 5 ? 'el tope' : nivel === 1 ? '1 bloque' : `${nivel} bloques`
}

/** G5 y H5: /precios. Lo que un docente lee en el celular cuando Mauro le pasa el link. */
export const PRECIOS = {
  titulo: 'Precios',
  frase: 'Pagás una clase por cada cinco alumnos que seguís.',
  bajada: (dias: number, cupoPrueba: number, cupoGratis: number) =>
    `Empezás con ${dias} días gratis, con hasta ${cupoPrueba} alumnos. Después seguís gratis con hasta ${cupoGratis}, o elegís un plan.`,
  empezar: (dias: number) => `Probar ${dias} días gratis`,
  /** H5: lo que no se paga va arriba, aparte de la tabla. */
  sinPagar: 'Sin pagar',
  gratisTitulo: 'Gratis',
  gratisDetalle: (cupo: number) => `Hasta ${cupo} alumnos, para siempre.`,
  gratisTope: (cuestionarios: number) => `Hasta ${cuestionarios} cuestionarios cada 30 días.`,
  pruebaTitulo: 'Prueba',
  pruebaDetalle: (dias: number, cupo: number) => `${dias} días con hasta ${cupo} alumnos, todo incluido. Sin tarjeta.`,
  planes: 'Planes',
  plan: 'Plan',
  columnaAlumnos: 'Alumnos',
  porMes: 'Por mes',
  pase: 'Pase de 90 días',
  nombreNivel: (nivel: number) => (nivel === 5 ? 'Tope' : nivel === 1 ? '1 bloque' : `${nivel} bloques`),
  alumnos: (cupo: number) => `Hasta ${cupo} alumnos`,
  pagar: (tipo: 'mensual' | 'pase', nivel: string, monto: string) =>
    `Pagar ${tipo === 'mensual' ? 'un mes' : 'el pase de 90 días'} de ${nivel}, ${monto}`,
  notas: (cupoGratis: number, cupoBloque: number) => [
    'Por mes son 30 días desde que se acredita el pago; el pase, 90 días. No es por mes calendario.',
    'Cuentan todos los alumnos de tus grupos, también los que entran sin cuenta. Un alumno en dos grupos tuyos cuenta una vez.',
    `Los ${cupoGratis} alumnos gratis no se suman a un plan: 1 bloque son ${cupoBloque} alumnos en total.`,
    `Si tu plan vence no se borra nada. Con ${cupoGratis} alumnos o menos seguís gratis; con más, seguís viendo todo y tus alumnos siguen respondiendo las tareas que ya les mandaste.`,
    'Precios en pesos argentinos.',
  ],
} as const
