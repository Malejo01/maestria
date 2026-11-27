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
  admin: { titulo: 'Administración' },
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
    /** P5 (O13, propuesta 4): ya la resolvió al menos uno. */
    detalleConIntentos: (n: number) =>
      n === 1
        ? 'Ya hay una resolución. En Mis alumnos ves en qué se equivocó.'
        : `Ya hay ${n} resoluciones. En Mis alumnos ves en qué se equivoca cada uno.`,
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
  /** P5: en la barra, mientras el docente no tenga una materia. */
  crearMateriaPrimero: 'Primero creá una materia',
  crearMateriaCorto: '+ Materia',
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
  /** O17: va como texto oculto delante del nombre, para que lo que se lee esté en el nombre accesible. */
  verFichaDe: 'Ver la ficha de',
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

/** Tanda AB · AB6: el muro del 3.er alumno, con la evidencia primero (lib/evidencia-del-muro.ts). */
export const MURO = {
  titulo: (cupoGratis: number) => `Tu plan gratis llega hasta ${cupoGratis} alumnos`,
  evidencia: 'Lo que ya pasó',
  oferta: (monto: string | null, alumnosPorBloque: number) =>
    monto ? `Sumá hasta ${alumnosPorBloque} alumnos por ${monto} al mes.` : `Sumá hasta ${alumnosPorBloque} alumnos con el plan Particular.`,
  garantia: 'Si en 14 días ninguno de tus alumnos practicó, te devuelvo el pago.',
  sinDebito: 'Sin débito automático: si no renovás, tus fichas quedan guardadas.',
  cargando: 'Mirando lo que practicaron…',
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
    detalle: (materia: string, deGrupo = false) =>
      `Sobre el programa de ${materia.replace(/\.$/, '')}. ${deGrupo ? 'Lo ven todos los alumnos del grupo' : 'Lo ve sólo este alumno'}, con un intento por cuestionario.`,
    modo: 'Cómo lo querés',
    porUnidad: { titulo: 'Por unidad', detalle: 'Un cuestionario por unidad. Se pueden rendir en días distintos.' },
    integral: { titulo: 'Integral', detalle: 'Un solo examen con todo el programa, hasta 40 preguntas.' },
    unidades: 'Qué temas entran',
    unidadesAyuda: 'Abrí cada unidad para destildar los temas que todavía no vieron.',
    temasDe: (incluidos: number, total: number) => (incluidos === total ? (total === 1 ? '1 tema' : `${total} temas`) : `${incluidos} de ${total} temas`),
    hastaEsteTema: 'Hasta este tema',
    hastaEsteTemaAria: (tema: string) => `Hasta ${tema}: tildar lo anterior y destildar lo que sigue`,
    tituloPropio: 'Título (opcional)',
    tituloEjemplo: 'Por ejemplo: Práctica parcial',
    tituloAyuda: 'Por unidad, cada cuestionario suma el nombre de la unidad: "Práctica parcial · Unidad III".',
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
    volverAGrupos: 'Volver a Mis grupos',
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
/** M2: en *Revisar y editar*, una consigna que no encaja con su tipo. */
export const TIPO_INCOHERENTE = {
  aviso: 'Esta consigna no encaja con su tipo',
  detalle: {
    'vf-pregunta-si-no': 'Es verdadero o falso, pero está escrita como pregunta. Conviene una afirmación que se pueda juzgar.',
    'vf-pregunta-abierta': 'Es verdadero o falso, pero pregunta algo que no se contesta con Verdadero o Falso.',
    'numerica-conceptual': 'Es numérica, pero la respuesta es un concepto o un nombre, no un número.',
    'inecuacion-como-valor': 'Pide "el valor" y la respuesta es un conjunto: conviene pedir el conjunto solución.',
    'inecuacion-formas': '',
  },
  pasarAOpcionMultiple: 'Pasar a opción múltiple',
  editar: 'Editar',
  convirtiendo: 'Armando las opciones…',
} as const

/** N2: corregir en lote las preguntas cuyo tipo no encaja con la consigna. */
export const CORREGIR_TIPOS = {
  boton: (n: number) => (n === 1 ? 'Corregir 1 pregunta' : `Corregir ${n} preguntas`),
  resumen: (n: number) =>
    n === 1 ? 'Hay 1 pregunta cuyo tipo no encaja con la consigna.' : `Hay ${n} preguntas cuyo tipo no encaja con la consigna.`,
  titulo: 'Corregir las preguntas marcadas',
  detalle:
    'Son las preguntas cuyo tipo no encaja con la consigna. Mirá cada cambio y destildá lo que no quieras. Nada se guarda hasta que toques Aplicar.',
  buscando: 'Armando las correcciones…',
  pregunta: (n: number) => `Pregunta ${n}`,
  antes: 'Antes',
  despues: 'Después',
  porRegla: 'corregida sin IA',
  porIa: 'reescrita con IA',
  noSePudo: 'Queda como está',
  aplicar: (n: number) => (n === 1 ? 'Aplicar 1 cambio' : `Aplicar ${n} cambios`),
  aplicando: 'Guardando…',
  cancelar: 'Cancelar',
  sinCambios: 'No hay nada para corregir.',
  queCargamos: 'las correcciones',
  correcta: 'Correcta',
  verdadero: 'Verdadero',
  falso: 'Falso',
  aplicado: (n: number) => (n === 1 ? 'Se corrigió 1 pregunta' : `Se corrigieron ${n} preguntas`),
  aplicadoCopia: 'Ya tenía intentos: se guardó como copia y las asignaciones pasaron a la versión corregida. Las respuestas que ya estaban no cambian.',
  aplicadoSinGuardar: 'Quedaron en la pantalla sin guardar: tocá Guardar para que las vean tus alumnos.',
  noSeGuardo: 'No se pudo guardar',
} as const

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

/** L4: la pestaña Mis grupos, al lado de Mis alumnos. */
export const MIS_GRUPOS = {
  pestanas: { etiqueta: 'Ver', alumnos: 'Mis alumnos', grupos: 'Mis grupos' },
  cargando: 'Buscando tus grupos…',
  queCargamos: 'tus grupos',
  vacio: {
    titulo: 'Todavía no tenés grupos abiertos',
    detalle: 'Un grupo se crea solo cuando sumás un alumno o mandás una tarea desde una materia.',
  },
  resumen: (codigo: string, alumnos: number, tareas: number) =>
    `Código ${codigo} · ${alumnos === 1 ? '1 alumno' : `${alumnos} alumnos`} · ${tareas === 1 ? '1 tarea mandada' : `${tareas} tareas mandadas`}`,
  armar: 'Armar diagnóstico o práctica',
  cerrar: 'Cerrar grupo',
  copiar: 'Copiar link',
  copiado: 'Copiado',
  /** O17: empieza por lo que dice el botón ("Copiar link"), para que coincida con el nombre accesible. */
  copiarLink: (grupo: string) => `Copiar link del grupo ${grupo}`,
  reabrir: 'Reabrir',
  borrar: 'Borrar',
  cerrados: {
    titulo: (n: number) => `Cerrados (${n})`,
    detalle: 'Sus alumnos ya no ven las tareas. La materia sigue en Mis materias.',
  },
  borrarDialogo: {
    titulo: (grupo: string) => `¿Borrar el grupo ${grupo}?`,
    detalle: (alumnos: number, tareas: number) =>
      `Se pierden ${alumnos === 1 ? '1 alumno' : `${alumnos} alumnos`} del grupo y ${tareas === 1 ? '1 tarea mandada' : `${tareas} tareas mandadas`}. No se puede deshacer.`,
    materia: 'La materia no se borra: si la volvés a usar, se arma un grupo nuevo.',
    cancelar: 'No borrar',
    confirmar: 'Sí, borrar el grupo',
  },
  seguimiento: {
    titulo: (n: number) => (n === 1 ? 'Diagnóstico o práctica del grupo (1)' : `Diagnósticos y prácticas del grupo (${n})`),
    armado: (fecha: string, modo: 'por_unidad' | 'integral') => `${modo === 'integral' ? 'Integral' : 'Por unidad'}, armado el ${fecha}`,
    hicieron: (preguntas: number, hicieron: number, total: number) =>
      `${preguntas === 1 ? '1 pregunta' : `${preguntas} preguntas`} · ${hicieron} de ${total} lo ${hicieron === 1 ? 'hizo' : 'hicieron'}`,
    porTema: 'Por tema',
    tema: (nombre: string, acertaron: number, rindieron: number) => `${nombre}: ${acertaron} de ${rindieron} la acertaron`,
    sinRespuestas: 'Cuando lo hagan, acá vas a ver tema por tema cuántos lo acertaron.',
  },
  /** M3: abrir la página del grupo tocando la tarjeta. */
  abrir: (grupo: string) => `Abrir el grupo ${grupo}`,
  diagnosticoAgosto: {
    titulo: 'Diagnóstico del 10 de agosto',
    detalle: 'Qué nivelar antes de avanzar, por unidad y con los pisos de azar a la vista',
  },
} as const

/** M6: el botón de reportar y el buzón. */
export const REPORTAR = {
  sobreLaPregunta: (n: number, cuestionario?: string) =>
    cuestionario ? `Sobre la pregunta ${n} de «${cuestionario}»` : `Sobre la pregunta ${n} de este cuestionario`,
} as const

export const BUZON = {
  titulo: 'Reportes',
  detalle: 'Lo que reportan docentes y alumnos desde el botón de reportar. Se leen a mano.',
  volver: 'Volver al panel',
  menu: 'Reportes',
  menuNuevos: (n: number) => (n === 1 ? '1 nuevo' : `${n} nuevos`),
  filtros: { etiqueta: 'Estado', todos: 'Todos', nuevo: 'Nuevos', visto: 'Vistos', resuelto: 'Resueltos' },
  estado: { nuevo: 'Nuevo', visto: 'Visto', resuelto: 'Resuelto' },
  marcarComo: { visto: 'Marcar como visto', resuelto: 'Marcar como resuelto', nuevo: 'Volver a nuevo' },
  vacio: 'No hay reportes en este estado.',
  cargando: 'Buscando reportes…',
  queCargamos: 'los reportes',
  invitado: 'invitado',
  sinNombre: 'Sin nombre',
  rol: { DOCENTE: 'docente', ALUMNO: 'alumno' } as Record<string, string>,
  ruta: (ruta: string) => `En ${ruta}`,
  grupo: (grupo: string) => `Grupo «${grupo}»`,
  pregunta: (n: number, cuestionario: string) => `Pregunta ${n} de «${cuestionario}»`,
  preguntaSinCuestionario: (id: string) => `Pregunta ${id} (sin contexto: el reporte es de antes)`,
  laPregunta: 'La pregunta, como está guardada',
  respuestaCorrecta: 'Respuesta correcta',
  revisar: 'Revisar y editar el cuestionario',
  abrir: 'Ver la pregunta',
  cerrar: 'Ocultar la pregunta',
  // N1: al resolver, un mensaje opcional para quien reportó.
  mensajeEtiqueta: 'Mensaje para quien lo reportó',
  mensajeAyuda: 'Opcional. Si lo dejás vacío, el aviso dice que ya está corregido.',
  confirmarResuelto: 'Marcar como resuelto',
  cancelar: 'Cancelar',
  avisoVisto: (fecha: string) => `Lo vio el ${fecha}`,
  avisoPendiente: 'Aviso pendiente: lo va a ver la próxima vez que entre',
  avisoDelAdmin: 'Sin aviso: lo reportó un admin',
  avisoSinQuien: 'Sin aviso: la cuenta de quien lo reportó ya no existe',
  avisoSinLa030: 'Sin aviso: falta la migración 030',
  tuMensaje: 'Tu mensaje',
} as const

/** O8: pulgar arriba / abajo del docente en cada pregunta. */
export const VALORACIONES = {
  arriba: 'Está bien',
  abajo: 'Está mal',
  porQue: '¿Qué tiene?',
  motivos: {
    fuera_del_programa: 'Fuera del programa',
    mal_redactada: 'Mal redactada',
    respuesta_incorrecta: 'Respuesta incorrecta',
    muy_facil: 'Muy fácil',
    muy_dificil: 'Muy difícil',
    tipo_equivocado: 'Tipo equivocado',
  },
  guardada: 'Gracias: la próxima generación de esta materia lo tiene en cuenta.',
  guardaPrimero: 'Guardá los cambios para valorar las preguntas',
  noSeGuardo: 'No se pudo guardar la valoración.',
  // /admin/ai-usage
  titulo: 'Valoraciones de los docentes',
  detalle: 'Pulgares abajo por motivo, en toda la app. Entran al prompt de la materia como "Evitá esto".',
  arribaTotal: (n: number) => (n === 1 ? '1 pulgar arriba' : `${n} pulgares arriba`),
  sinDatos: 'Todavía no hay valoraciones.',
} as const

/** O9: el informe del grupo para imprimir. */
export const INFORME_IMPRESO = {
  boton: 'Imprimir informe',
  imprimir: 'Imprimir',
  volver: 'Volver al grupo',
  ayuda: 'Se imprime en A4. Para guardarlo como PDF, elegí "Guardar como PDF" en la impresora.',
  titulo: (grupo: string) => `Informe del grupo ${grupo}`,
  fecha: (fecha: string) => `Al ${fecha}`,
  resumen: (alumnos: number, promedio: string, resueltos: number) =>
    `${alumnos === 1 ? '1 alumno' : `${alumnos} alumnos`} · promedio ${promedio} · ${resueltos === 1 ? '1 cuestionario resuelto' : `${resueltos} cuestionarios resueltos`}`,
  planilla: 'Planilla',
  temas: 'Temas flojos del grupo',
  temasColumnas: ['Tema', 'Aciertos', 'Alumnos'],
  sinTemas: 'No hay temas flojos.',
  tareas: 'Tareas',
  tareasColumnas: ['Tarea', 'La hicieron'],
  sinTareas: 'Todavía no hay tareas mandadas.',
  hicieron: (n: number, de: number) => `${n} de ${de}`,
  sinAlumnos: 'Nadie coincide con el filtro.',
  cargando: 'Armando el informe…',
  queCargamos: 'el informe',
  ordenadaPor: (columna: string, sentido: string) => `Ordenada por ${columna.toLowerCase()}, ${sentido}`,
  ascendente: 'de menor a mayor',
  descendente: 'de mayor a menor',
  columnas: {
    alumno: 'Alumno',
    resueltos: 'Resueltos',
    promedio: 'Promedio',
    mejor: 'Mejor nota',
    actividad: 'Última actividad',
    temas: 'Temas flojos',
  } as Record<string, string>,
  filtro: { todos: '', nada: 'Sólo los que no respondieron nada', debajo: 'Sólo los que están debajo de 6', flojos: 'Sólo los que tienen temas flojos' } as Record<string, string>,
  busqueda: (texto: string) => `Buscando «${texto}»`,
} as const

/** O10: la campanita de avisos del docente. */
/** P2: lo común de las dos campanitas (docente y alumno). */
export const AVISOS = {
  // Con más de 9 el globo dice "9+": el nombre lo contiene (axe, label-in-name). El número exacto lo dice `contador`.
  boton: (n: number) => (n === 0 ? 'Avisos' : n === 1 ? 'Avisos: 1 sin leer' : n > 9 ? 'Avisos: 9+ sin leer' : `Avisos: ${n} sin leer`),
  contador: (n: number) => (n === 0 ? 'No tenés avisos sin leer' : n === 1 ? '1 aviso sin leer' : `${n} avisos sin leer`),
  titulo: 'Avisos',
  cargando: 'Buscando avisos…',
  marcarTodo: 'Marcar todo como leído',
  sinLeer: 'Sin leer',
  grupos: { hoy: 'Hoy', ayer: 'Ayer', antes: 'Antes' },
  relativa: {
    recien: 'hace un momento',
    minutos: (n: number) => `hace ${n} min`,
    horas: (n: number) => `hace ${n} h`,
    ayer: 'ayer',
    dias: (n: number) => `hace ${n} días`,
  },
} as const

/** P3: los avisos del alumno (con cuenta o invitado). */
export const AVISOS_ALUMNO = {
  vacio: 'No tenés avisos nuevos.',
  vacioDetalle: 'Cuando tu docente te mande una tarea o se acerque una fecha, te avisamos acá.',
  tareaNueva: 'Tarea nueva',
  vencePronto: (horas: number) => (horas < 1 ? 'Vence en menos de 1 h' : `Vence en ${horas} h`),
  detalleTarea: (grupo: string, tarea: string) => `${grupo} · ${tarea}`,
  diagnosticoNuevo: 'Diagnóstico nuevo',
  detalleDiagnostico: (grupo: string, n: number) => `${grupo} · ${n === 1 ? '1 cuestionario' : `${n} cuestionarios`}`,
  reporteResuelto: 'Tu reporte se resolvió',
  detalleReporte: (quien: string | null, conMensaje: boolean) =>
    conMensaje ? `${quien ?? 'Tu docente'} te dejó un mensaje` : 'Ya está corregido. Gracias por avisar.',
  temaSuperado: 'Tema superado',
  detalleTema: (tema: string, porDocente: boolean) => (porDocente ? `${tema} · lo marcó tu docente` : `${tema} · pasó a "Ya lo dominás"`),
  rachaEnRiesgo: (n: number) => `Tu racha de ${n} ${n === 1 ? 'aprobado' : 'aprobados'} está en riesgo`,
  detalleRacha: 'Todavía no practicaste hoy',
} as const

/** P3: la página de un reporte propio, a la que lleva "Tu reporte se resolvió". */
export const REPORTE_PROPIO = {
  titulo: 'Tu reporte',
  loQueReportaste: 'Lo que reportaste',
  cuestionario: (titulo: string) => `En «${titulo}»`,
  reportadoEl: (fecha: string) => `Lo mandaste el ${fecha}`,
  resueltoEl: (fecha: string) => `Se resolvió el ${fecha}`,
  pendiente: 'Todavía lo estamos revisando.',
  mensajeDe: (quien: string | null) => `Mensaje de ${quien ?? 'tu docente'}`,
  sinMensaje: 'Ya está corregido. Gracias por avisar: así la tarea queda mejor para todos.',
  volver: 'Volver a mis tareas',
} as const

/** O10/P2: los avisos del docente. Título corto + una línea de detalle. */
export const AVISOS_DOCENTE = {
  vacio: 'Nada nuevo en las últimas dos semanas.',
  vacioDetalle: 'Cuando tus alumnos terminen una tarea o entren a un grupo, te avisamos acá.',
  terminaron: (n: number) => (n === 1 ? '1 alumno terminó la tarea' : `${n} terminaron la tarea`),
  nuevos: (n: number) => (n === 1 ? '1 alumno nuevo' : `${n} alumnos nuevos`),
  nuevosDetalle: (n: number, grupo: string) => `${n === 1 ? 'Entró' : 'Entraron'} a ${grupo}`,
  reportes: (n: number) => (n === 1 ? 'Reportaron un problema' : `Reportaron ${n} problemas`),
  reportesDetalle: (grupo: string | null) => (grupo ? `En ${grupo}` : 'En un cuestionario tuyo'),
  detalleTarea: (grupo: string, tarea: string) => `${grupo} · ${tarea}`,
} as const

/** O6: el reporte del diagnóstico del 10/08, leído contra un programa. */
export const DIAGNOSTICO_DEL_CURSO = {
  leerContra: 'Leer contra el programa de',
  mapaOriginal: 'Análisis de Sistemas (el mapa con que se armó el 10/08)',
} as const

/** O2: "A reforzar" se cierra (3 aciertos seguidos) o lo cierra el docente. */
export const A_REFORZAR = {
  superado: 'superado',
  marcarSuperado: 'Ya lo superó',
  volverAReforzar: 'Volver a reforzar',
  yaLoDominas: 'Ya lo dominás',
  yaLoDominasDetalle: (n: number) =>
    n === 1 ? '1 tema que tenías para reforzar y ya superaste.' : `${n} temas que tenías para reforzar y ya superaste.`,
  superadoEl: (fecha: string) => `Superado el ${fecha}`,
} as const

/** N1: el aviso a quien reportó, cuando su reporte se resolvió. */
export const AVISO_DE_REPORTE = {
  etiqueta: 'Tu reporte',
  uno: (fecha: string, cuestionario: string | null) =>
    cuestionario
      ? `Gracias por avisarnos. Lo que reportaste el ${fecha} sobre una pregunta de «${cuestionario}» ya está corregido.`
      : `Gracias por avisarnos. Lo que reportaste el ${fecha} ya está corregido.`,
  varios: (n: number) => `Gracias por avisarnos. Ya corregimos los ${n} problemas que reportaste:`,
  renglon: (fecha: string, cuestionario: string | null) =>
    cuestionario ? `El del ${fecha}, sobre una pregunta de «${cuestionario}».` : `El del ${fecha}.`,
  mensaje: (quien: string | null, texto: string) =>
    quien ? `${quien} te dejó un mensaje: ${texto}` : `Te dejamos un mensaje: ${texto}`,
  entendido: 'Entendido',
} as const

/** M6: en la página del grupo, lo que reportaron sus alumnos. */
export const REPORTES_DEL_GRUPO = {
  titulo: (n: number) =>
    n === 1 ? 'Tus alumnos reportaron 1 problema en las tareas de este grupo' : `Tus alumnos reportaron ${n} problemas en las tareas de este grupo`,
  pregunta: (n: number, cuestionario: string) => `Pregunta ${n} de «${cuestionario}»`,
  revisar: 'Revisar y editar',
} as const

/** M3: la página de un grupo (`/teacher/grupos/[id]`). */
export const PAGINA_DEL_GRUPO = {
  volver: 'Mis grupos',
  cargando: 'Buscando el seguimiento del grupo…',
  queCargamos: 'el seguimiento del grupo',
  cerrado: 'Grupo cerrado: sus alumnos ya no ven las tareas.',
  alumnos: (n: number) => (n === 1 ? '1 alumno' : `${n} alumnos`),
  codigo: (codigo: string) => `Código ${codigo}`,
  mandarTarea: 'Mandar tarea',
  reabrir: 'Reabrir grupo',
  regenerarCodigo: 'Regenerar código',
  regenerarDialogo: {
    titulo: '¿Cambiás el código del grupo?',
    detalle: 'El código y el link de ahora dejan de servir. Los alumnos que ya entraron siguen en el grupo.',
    cancelar: 'No cambiar',
    confirmar: 'Sí, cambiar el código',
  },
  codigoNuevo: 'Listo: el código cambió.',
  nuevo: 'Grupo creado. Copiá el link y mandáselo a tus alumnos.',
  pestanas: {
    etiqueta: 'Secciones del grupo',
    alumnos: (n: number) => `Alumnos (${n})`,
    tareas: (n: number) => `Tareas (${n})`,
    temas: (n: number) => `Temas (${n})`,
    diagnosticos: (n: number) => `Diagnósticos (${n})`,
  },
  resumen: {
    alumnos: 'alumnos',
    promedio: 'promedio del grupo',
    resueltos: 'cuestionarios resueltos',
    sinActividad: 'sin actividad',
  },
  planilla: {
    titulo: 'Seguimiento por alumno',
    vacio: (codigo: string) => `Todavía no entró nadie. Compartí el link o el código ${codigo}.`,
    alumno: 'Alumno',
    resueltos: 'Resueltos',
    promedio: 'Promedio',
    mejor: 'Mejor',
    temasFlojos: 'Temas flojos',
    ultimaActividad: 'Última actividad',
    sinVerificar: 'sin verificar',
    verificada: 'Cuenta verificada',
    quitar: (nombre: string) => `Quitar a ${nombre}`,
    descargar: 'Descargar notas',
    descargadas: 'Notas descargadas: el archivo se abre en Excel o Google Sheets.',
    copiarDe: 'Sumar alumnos de otro grupo',
    copiarBoton: 'Sumar',
    // O7: traer alumnos de otro grupo, eligiendo.
    traer: {
      boton: 'Traer alumnos de otro grupo',
      titulo: (grupo: string) => `Traer alumnos a ${grupo}`,
      detalle: 'Elegí de qué grupo y a quiénes. Siguen estando en su grupo: se suman a este.',
      deQueGrupo: 'De qué grupo',
      elegirGrupo: 'Elegí un grupo',
      buscando: 'Buscando los alumnos…',
      todos: 'Todos',
      ninguno: 'Ninguno',
      yaEsta: 'ya está en este grupo',
      invitado: 'sin cuenta',
      vacio: 'Ese grupo no tiene alumnos para traer.',
      confirmar: (n: number, grupo: string) =>
        n === 1 ? `Traer 1 alumno a ${grupo}` : `Traer ${n} alumnos a ${grupo}`,
      cancelar: 'Cancelar',
      trayendo: 'Trayendo…',
    },
    copiados: (n: number) => (n === 1 ? '1 alumno ahora también está en este grupo.' : `${n} alumnos ahora también están en este grupo.`),
    pie: 'Tocá el nombre para ver todo lo que hizo. Los "sin verificar" entraron con su nombre, sin cuenta.',
    columnas: ['Alumno', 'Verificado', 'Resueltos', 'Promedio', 'Mejor nota', 'Aprobados', 'Última actividad', 'Temas flojos'],
    // M4: ordenar, buscar y filtrar.
    buscar: 'Buscar por nombre',
    filtros: {
      etiqueta: 'Mostrar',
      todos: (n: number) => `Todos (${n})`,
      nada: (n: number) => `No respondieron nada (${n})`,
      debajo: (nota: number, n: number) => `Debajo de ${nota} (${n})`,
      flojos: (n: number) => `Con temas flojos (${n})`,
    },
    ordenarPor: (columna: string) => `Ordenar por ${columna}`,
    acciones: 'Acciones',
    ningunoCoincide: 'Nadie coincide con la búsqueda o el filtro.',
    mostrando: (n: number, total: number) => (n === total ? '' : `Mostrando ${n} de ${total}.`),
    si: 'Sí',
    no: 'No',
  },
  tareas: {
    titulo: 'Lo que le mandaste al grupo',
    vacio: 'Todavía no le mandaste ninguna tarea. Usá "Mandar tarea".',
    entregaron: (n: number) => (n === 1 ? '1 la hizo' : `${n} la hicieron`),
    pendientes: (n: number) => (n === 1 ? '1 pendiente' : `${n} pendientes`),
    promedio: (nota: string) => `Promedio (mejor intento): ${nota}`,
    desde: (fecha: string) => `Desde: ${fecha}`,
    hasta: (fecha: string) => `Hasta: ${fecha}`,
    intentos: (maximo: number | null, hechos: number) =>
      `Intentos: ${maximo ?? 'sin límite'} · ${hechos} ${hechos === 1 ? 'hecho' : 'hechos'}`,
    quitar: 'Quitar del grupo',
    // M4: la planilla de una tarea puntual.
    verQuienes: 'Ver quién la hizo',
    ocultarQuienes: 'Ocultar',
    planilla: {
      titulo: (tarea: string) => `Quién hizo «${tarea}»`,
      cargando: 'Buscando quién la hizo…',
      queCargamos: 'quién hizo la tarea',
      vacio: 'Todavía no hay alumnos en el grupo.',
      alumno: 'Alumno',
      intentos: 'Intentos',
      nota: 'Mejor nota',
      ultima: 'Última vez',
      descargar: 'Descargar',
      filtros: {
        todos: (n: number) => `Todos (${n})`,
        nada: (n: number) => `No la hicieron (${n})`,
        debajo: (nota: number, n: number) => `Debajo de ${nota} (${n})`,
      },
      columnas: ['Alumno', 'Intentos', 'Mejor nota', 'Promedio', 'Última vez'],
    },
  },
  temas: {
    titulo: 'Cómo le fue al grupo por tema',
    vacio: 'Todavía no hay respuestas suficientes. Aparecen acá los temas con al menos 3 respuestas del grupo.',
    detalle: (bien: number, total: number, alumnos: number) =>
      `${bien} de ${total} · ${alumnos === 1 ? '1 alumno' : `${alumnos} alumnos`}`,
    pie: 'De peor a mejor. Por debajo del 60 % conviene volver sobre el tema en clase.',
  },
  diagnosticos: {
    vacio: 'Todavía no le armaste un diagnóstico ni una práctica a este grupo.',
  },
  invitados: {
    lleno: (tope: number) => `Tu grupo llegó al tope de ${tope} ingresos sin cuenta en 24 h.`,
    cerca: (nuevos: number, tope: number) => `Tu grupo lleva ${nuevos} de ${tope} ingresos sin cuenta permitidos en 24 h.`,
    llenoDetalle: 'Los que intenten entrar sin cuenta ahora ven un aviso y no pueden sumarse; con cuenta de Google entran igual. ',
    cercaDetalle: 'Al llegar al tope, los próximos sin cuenta no van a poder entrar. ',
    queHacer:
      'Si son tus alumnos, pediles que entren con Google. Si no reconocés a los que entraron, el código puede haberse filtrado: regeneralo. Regenerar corta la filtración, pero el cupo se va liberando a medida que pasan las 24 h de cada ingreso.',
  },
  elegirTarea: {
    titulo: 'Mandar una tarea al grupo',
    detalle: 'Elegí una de las tareas que armaste para esta materia.',
    cargando: 'Buscando tus tareas…',
    vacio: 'Todavía no armaste tareas para esta materia.',
    armar: 'Armar una tarea',
  },
} as const

/** M3: crear un grupo nuevo (antes "Crear aula", escondido en la gestión). */
export const CREAR_GRUPO = {
  boton: 'Crear grupo',
  titulo: 'Crear un grupo',
  detalle: 'Cada grupo trabaja con una materia. Al crearlo te damos el link para tus alumnos.',
  materia: 'Materia',
  sinMaterias: 'Primero creá una materia en "Mis materias".',
  nombre: 'Nombre del grupo',
  ejemplo: 'Por ejemplo: 3° A turno mañana',
  crear: 'Crear grupo',
  cancelar: 'Cancelar',
  faltaMateria: 'Elegí la materia del grupo.',
  faltaNombre: 'Ponele un nombre al grupo.',
  fallo: 'No se pudo crear el grupo.',
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

/** O4: la racha (aprobados seguidos), en resultados. Vive en la base (032). */
export const RACHA = {
  titulo: 'Racha',
  sinRacha: 'Cuando apruebes un cuestionario, empieza tu racha.',
  conRacha: (n: number) => (n === 1 ? 'Aprobaste 1 cuestionario seguido.' : `Aprobaste ${n} cuestionarios seguidos.`),
} as const

/** O4: lo que quedaba suelto en la pantalla de resultados. */
export const RESULTADOS = {
  /** P8: la barra de abajo de los resultados, como región con nombre. */
  acciones: 'Qué hacer ahora',
  explicarError: 'Explicame el error',
  cargando: 'Cargando…',
} as const

export const MI_PROGRESO = {
  titulo: 'Mi progreso',
  detalle: 'Lo que hiciste, los temas que te conviene reforzar y tus tips.',
  pestanas: {
    historial: 'Lo que hice',
    reforzar: (n: number) => (n > 0 ? `A reforzar (${n})` : 'A reforzar'),
    tips: 'Mis tips',
  },
  // O4: lo que hace el alumno son cuestionarios (tareas y prácticas), no "evaluaciones".
  cuestionarios: 'Cuestionarios',
  ultimos: 'Lo último que hiciste',
  modos: { all: 'Todos', teorico: 'Teórico', practico: 'Práctico', mixto: 'Mixto' },
  filtroModo: 'Modo',
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
    despuesGratis: (cupo: number) => `Después seguís gratis con hasta ${cupo} alumnos particulares y un curso.`,
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
    `Empezás con ${dias} días gratis, con hasta ${cupoPrueba} alumnos. Después seguís gratis con hasta ${cupoGratis} alumnos particulares y un curso, o elegís un plan.`,
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
  // ─── Ronda T · B3: dos caminos ──────────────────────────────────────────────
  comoDasClases: '¿Cómo das clases?',
  caminos: {
    particular: { titulo: 'Clases particulares', detalle: 'Seguís a cada alumno: su ficha, su diagnóstico, sus tareas.' },
    aula: { titulo: 'Cursos en un instituto o escuela', detalle: 'Seguís al curso: tareas y diagnósticos para todos.' },
  },
  elegiUnCamino: 'Elegí cómo das clases y te mostramos los planes que te sirven.',
  tuPlan: 'Tu plan',
  gratisCaminoDetalle: (particulares: number, porCurso: number) =>
    `Hasta ${particulares} alumnos particulares y 1 curso de hasta ${porCurso}, para siempre.`,
  gratisSinExtras: 'Sin informe para imprimir ni exportación a Moodle.',
  paseTemporada: 'Pase temporada de mesas',
  paseTemporadaDetalle: 'Los 90 días antes de las mesas, pagados de una vez.',
  porAlumnoPorMes: (monto: string) => `Son ${monto} por alumno por mes.`,
  aulaTitulo: 'Plan Aula',
  aulaCurso: (porCurso: number) => `Un curso de hasta ${porCurso} alumnos`,
  aulaCursoDetalle: 'Tareas y diagnósticos del curso, el informe para imprimir y la exportación a Moodle. 60 cuestionarios cada 30 días.',
  aulaAdicional: 'Cada curso adicional',
  pagarAula: 'Pagar un curso',
  aulaSinIndividual: 'Sin fichas ni diagnósticos de cada alumno: eso es del plan Particular.',
  porMesCorto: 'por mes',
  institucionTitulo: 'Institución',
  institucionDetalle: 'Varios docentes y cursos de un instituto o una escuela, a medida.',
  hablemos: 'Hablemos',
  hablemosMensaje: 'Hola, quiero hablar del plan Institución de MaestrIA.',
  porQueTitulo: '¿Por qué un curso sale menos que 5 alumnos particulares?',
  porQueTexto:
    'Por lo mismo que vos cobrás distinto una clase particular y una hora en un curso. En el plan Particular seguís a cada alumno como persona: su ficha, su diagnóstico, sus tareas, lo que le falta antes de su examen. En el plan Aula seguís al curso: tareas y diagnósticos para todos, y el informe del grupo. Si das particulares y cursos, podés tener los dos.',
} as const

/** M1: el cuestionario a medio hacer y el guardado del resultado. */
export const CUESTIONARIO_EMPEZADO = {
  titulo: 'Tenés un cuestionario empezado',
  progreso: (respondidas: number, total: number) =>
    `${respondidas} de ${total} ${total === 1 ? 'respondida' : 'respondidas'}`,
  detalle: 'Quedó guardado en este dispositivo. Podés seguir desde la pregunta donde estabas.',
  seguir: 'Seguir donde estaba',
  empezarDeNuevo: 'Empezar de nuevo',
  confirmar: {
    titulo: '¿Empezás de nuevo?',
    detalle: 'Se borra lo que respondiste y arrancás desde la primera pregunta. No se puede deshacer.',
    si: 'Sí, empezar de nuevo',
    no: 'Volver',
  },
  /** /practicar: la práctica libre a medio hacer. */
  practica: (materia: string) => `Práctica de ${materia}`,
} as const

export const GUARDADO_DEL_RESULTADO = {
  guardando: 'Guardando…',
  guardado: 'Guardado',
  sinConexion: 'Sin conexión: lo guardamos apenas vuelva internet',
  error: (mensaje: string) => `No se pudo guardar: ${mensaje}`,
  reintentar: 'Reintentar ahora',
} as const

/** O12: el embudo del docente (sólo admin). */
export const EMBUDO = {
  menu: 'Embudo de docentes',
  titulo: 'Embudo de docentes',
  detalle: 'En qué paso está cada docente y desde cuándo. Sale de las tablas de la app. Los trabados más de 3 días en un paso van arriba, con su email, para contactarlos.',
  volver: 'Volver a la app',
  pasos: {
    registro: 'Se registró',
    materia: 'Creó una materia',
    grupo: 'Creó un grupo',
    tarea: 'Mandó la primera tarea',
    primerAlumno: 'El primer alumno la hizo',
    cincoAlumnos: '5 alumnos activos',
  },
  trabados: (n: number) => (n === 1 ? '1 docente trabado' : `${n} docentes trabados`),
  sinTrabados: 'Nadie trabado más de 3 días.',
  resto: 'El resto',
  enPaso: (paso: string, dias: number) => `${paso} · ${dias === 0 ? 'hoy' : dias === 1 ? 'hace 1 día' : `hace ${dias} días`}`,
  terminado: 'Llegó a 5 alumnos activos',
  sinNombre: 'Sin nombre',
  columnas: { docente: 'Docente', paso: 'Paso', desde: 'Desde' },
  vacio: 'Todavía no hay docentes.',
} as const

/** O13: Mis materias. */
export const MIS_MATERIAS = {
  elegir: (materia: string) => `Elegir ${materia}`,
} as const

/** O17 · Nombres accesibles del cuestionario (lo que lee un lector de pantalla). */
export const CUESTIONARIO_ACCESIBLE = {
  salir: 'Salir del cuestionario',
  avance: 'Avance del cuestionario',
} as const

/** P1: el panel de administrador (sólo ADMIN_EMAILS). */
export const ADMIN = {
  boton: 'Admin',
  botonEtiqueta: 'Panel de administrador',
  menu: 'Panel de administrador',
  titulo: 'Panel de administrador',
  detalle: 'Lo de hoy y cada sección con su número. Sólo lo ves vos.',
  navEtiqueta: 'Secciones de administración',
  volverALaApp: 'Volver a la app',
  secciones: {
    inicio: 'Inicio',
    reportes: 'Reportes',
    embudo: 'Embudo',
    usoDeIA: 'Uso de IA',
    planes: 'Planes',
    codigos: 'Códigos',
    docentes: 'Docentes',
    salud: 'Salud',
  },
  hoy: {
    titulo: 'Hoy',
    docentesActivos: 'Docentes activos',
    docentesActivosAyuda: 'Generaron, guardaron o mandaron algo, o un alumno les respondió',
    alumnos: 'Alumnos que respondieron',
    intentos: 'Intentos terminados',
    reportesNuevos: 'Reportes nuevos',
  },
  sinDato: '—',
  tarjetas: {
    codigos: 'Crear y desactivar códigos de descuento',
    reportes: (n: number) => (n === 0 ? 'Ninguno nuevo' : n === 1 ? '1 nuevo' : `${n} nuevos`),
    embudo: (n: number) => (n === 0 ? 'Nadie trabado más de 3 días' : n === 1 ? '1 docente trabado más de 3 días' : `${n} docentes trabados más de 3 días`),
    usoDeIA: (usd: string, llamadas: number) => `${usd} este mes · ${llamadas === 1 ? '1 llamada' : `${llamadas} llamadas`} hoy`,
    planes: (prueba: number, vencen: number, vencidos: number) =>
      `${prueba} en prueba · ${vencen} vencen esta semana · ${vencidos} ${vencidos === 1 ? 'vencido' : 'vencidos'}`,
    docentes: (n: number) => (n === 1 ? '1 docente' : `${n} docentes`),
    salud: (alertas: number) => (alertas === 0 ? 'Todo en orden' : alertas === 1 ? '1 cosa para mirar' : `${alertas} cosas para mirar`),
    abrir: 'Abrir',
  },
  docentes: {
    titulo: 'Docentes',
    detalle: 'Todos los docentes con su plan, lo que armaron y su última actividad. De los alumnos, sólo cantidades.',
    columnas: {
      docente: 'Docente',
      alta: 'Alta',
      plan: 'Plan',
      materias: 'Materias',
      grupos: 'Grupos',
      alumnos: 'Alumnos activos',
      ultima: 'Última actividad',
    },
    nunca: 'Nunca',
    vacio: 'Todavía no hay docentes.',
    volver: 'Todos los docentes',
    sinNombre: 'Sin nombre',
    materias: 'Materias',
    grupos: 'Grupos',
    sinMaterias: 'No creó materias.',
    sinGrupos: 'No creó grupos.',
    archivada: 'Archivada',
    cerrado: 'Cerrado',
    unidades: (n: number) => (n === 1 ? '1 unidad' : `${n} unidades`),
    tareas: (n: number) => (n === 1 ? '1 tarea' : `${n} tareas`),
    alumnosDelGrupo: (n: number) => (n === 1 ? '1 alumno activo' : `${n} alumnos activos`),
    creadoEl: (fecha: string) => `Desde el ${fecha}`,
    estado: { exento: 'Exento', prueba: 'Prueba', activo: 'Activo', gratis: 'Gratis', vencido: 'Vencido' },
  },
}

/** P4: "Practicar otra vez con preguntas nuevas" al terminar una tarea. */
export const PRACTICA_EXTRA = {
  boton: 'Practicar otra vez con preguntas nuevas',
  detalle: 'Mismos temas que la tarea. No cambia tu nota.',
  quedan: (n: number) => (n === 1 ? 'Te queda 1 por hoy' : `Te quedan ${n} por hoy`),
  armando: 'Armando preguntas nuevas…',
  tope: 'Por hoy ya hiciste 3 prácticas de esta tarea. Mañana podés seguir.',
  // B1 (ronda T): el plan Aula tiene 10 prácticas extra por alumno por mes.
  topeMes: 'Este mes ya hiciste las 10 prácticas extra de tu curso. Seguí con las tareas.',
  noDisponible: 'Esta práctica no está disponible.',
  fallo: 'No pudimos armar la práctica',
  falloDetalle: 'Probá de nuevo en un rato.',
  /** En el informe del grupo y la ficha. */
  etiqueta: 'Prácticas extra',
  resumen: (cantidad: number, promedio: number | null) =>
    `Prácticas extra: ${cantidad}${promedio === null ? '' : ` · promedio ${promedio.toLocaleString('es-AR')}`}`,
} as const

/** P7: "A reforzar" en la ficha del alumno (lo mismo que ve el alumno en Mi progreso). */
export const FICHA_A_REFORZAR = {
  titulo: (n: number) => `A reforzar (${n})`,
} as const

/** Ronda T · D2: separar en temas lo ya guardado. */
export const SEPARAR_EN_TEMAS = {
  boton: 'Separar en temas',
  botonEtiqueta: (tema: string) => `Separar en temas: ${tema.slice(0, 60)}`,
  titulo: 'Separar en temas',
  detalle: 'Revisá la propuesta: podés corregir o sacar temas antes de guardar. El primero conserva lo que ya tenía (A reforzar, diagnósticos).',
  buscando: 'Armando la propuesta…',
  conIA: 'La propuesta la armó la IA con las palabras del tema.',
  sinPropuesta: 'No encontramos cómo separarlo. Podés editarlo desde Editar materia.',
  quitar: (tema: string) => `Quitar "${tema.slice(0, 40)}"`,
  temaN: (n: number) => `Tema ${n}`,
  guardar: 'Guardar',
  guardando: 'Guardando…',
  cancelar: 'Cancelar',
  listo: 'Listo, quedó separado.',
  pedazosInvalidos: 'Tienen que quedar al menos 2 temas, sin repetir.',
  noSePudo: 'No se pudo separar. Probá de nuevo.',
} as const

/** Ronda T · E1: el modo autodidacta (el alumno que se prepara solo). */
export const AUTODIDACTA = {
  entrada: 'Me preparo solo para un examen',
  entradaDetalle: 'Subí el programa de tu materia, poné la fecha del examen y te armamos un plan hasta ese día.',
  titulo: 'Me preparo solo para un examen',
  mayor: {
    titulo: 'Antes de empezar',
    declaracion: 'Declaro que soy mayor de 18 años.',
    detalle: 'Por ahora, este modo es para mayores de 18.',
    seguir: 'Seguir',
  },
  misMaterias: 'Mis materias',
  ninguna: 'Todavía no subiste ninguna materia.',
  nueva: 'Nueva materia',
  nombre: 'Nombre de la materia',
  fechaExamen: 'Fecha del examen',
  programa: 'Programa de la materia (PDF o Word)',
  leyendo: 'Leyendo el programa…',
  temasLeidos: (unidades: number, temas: number) => `Leímos ${unidades} ${unidades === 1 ? 'unidad' : 'unidades'} y ${temas} temas.`,
  noSePudoLeer: 'No pudimos leer el programa. Probá con otro archivo.',
  crear: 'Crear mi materia',
  creando: 'Creando…',
  examenEl: (fecha: string) => `Examen el ${fecha}`,
  faltan: (dias: number) => (dias === 0 ? 'El examen es hoy' : dias === 1 ? 'Falta 1 día' : `Faltan ${dias} días`),
  temas: (n: number) => (n === 1 ? '1 tema' : `${n} temas`),
  abrir: 'Abrir',
  volver: 'Mis materias',
  diagnostico: 'Diagnóstico inicial',
  diagnosticoDetalle: 'Una pregunta por tema, sin ver si acertás hasta el final. Con esto armamos tu plan.',
  hacerDiagnostico: 'Hacer el diagnóstico',
  loQueSabes: 'Lo que ya sabés',
  loQueReforzar: 'Lo que tenés que reforzar',
  sinDatos: 'Todavía sin datos',
  plan: 'Tu plan hasta el examen',
  hoy: 'Hoy',
  practicaDeHoy: 'Práctica de hoy (10 preguntas)',
  diaDeSimulacro: 'Simulacro',
  simulacro: 'Simulacro de examen',
  simulacroDetalle: 'Cronometrado, sin ver si acertás hasta el final. Generado sólo desde tu programa.',
  nuncaReales: 'Nunca usamos preguntas de exámenes reales.',
  empezarSimulacro: (preguntas: number, minutos: number) => `${preguntas} preguntas en ${minutos} minutos`,
  generando: 'Armando las preguntas…',
  noSePudo: 'No se pudo armar el cuestionario. Probá de nuevo.',
  volverAMiPlan: 'Volver a mi plan',
  guardado: 'Tu plan se actualizó con este resultado.',
  /** E2: el pase por materia. */
  materiaAjena: 'Esa materia no es tuya.',
  paseNecesario: 'Ya usaste lo gratis de esta materia. Con el pase seguís hasta el examen.',
  gratis: (practicas: number) =>
    practicas === 0
      ? 'Ya usaste las dos prácticas gratis de esta materia.'
      : `Gratis: el diagnóstico y ${practicas === 1 ? '1 práctica más' : `${practicas} prácticas`}. Con el pase, el plan completo y los simulacros hasta el examen.`,
  conPase: (hasta: string) => `Tenés el pase de esta materia hasta el ${hasta}.`,
  sacarPase: (precio: string) => `Sacar el pase (${precio})`,
  sacarPaseSinPrecio: 'Sacar el pase',
  conPaseSimulacros: 'Los simulacros vienen con el pase.',
  /** U2: cambiar la fecha del examen (el pase se corre una vez). */
  cambiarFecha: 'Cambiar la fecha',
  fechaNueva: 'Fecha nueva del examen',
  guardarFecha: 'Guardar',
  guardandoFecha: 'Guardando…',
  cancelar: 'Cancelar',
  fechaInvalida: 'Elegí una fecha de hoy en adelante.',
  fechaCambiada: 'Listo, cambiamos la fecha del examen.',
  paseCorrido: (hasta: string) => `Tu pase se corrió con la fecha: ahora vale hasta el ${hasta}.`,
  paseYaCorrido: (hasta: string) => `El pase ya se corrió una vez con la fecha del examen: sigue hasta el ${hasta}.`,
  paseNoAcorta: (hasta: string) => `Tu pase sigue hasta el ${hasta}: nunca se acorta.`,
  avisoDelPase: 'Si tenés el pase, se corre con la fecha nueva una sola vez y nunca se acorta.',
} as const

/** Ronda T · E1: el simulacro cronometrado. */
export const SIMULACRO = {
  tiempoRestante: (tiempo: string) => `Tiempo restante: ${tiempo}`,
  titulo: 'Simulacro de examen',
  etiqueta: 'Simulacro',
  aviso: (preguntas: number, minutos: number) =>
    `Tenés ${minutos} minutos para ${preguntas} preguntas. El tiempo empieza cuando tocás Empezar; si se acaba, el simulacro termina con lo que respondiste.`,
} as const

/** Ronda T · F2 a F7: los tipos de pregunta "como en Moodle". */
export const TIPOS_MOODLE_TEXTOS = {
  variasCorrectas: {
    consigna: 'Marcá todas las correctas.',
    grupo: 'Opciones: puede haber más de una correcta',
    falto: 'Era correcta y no la marcaste.',
    editor: 'Opciones — marcá todas las correctas',
  },
  emparejamiento: {
    consigna: 'Elegí la pareja de cada uno.',
    elegir: 'Elegí…',
    pareja: (izquierda: string) => `Pareja de: ${izquierda.slice(0, 80)}`,
    correcta: (derecha: string) => `Correcta: ${derecha}`,
    editor: 'Pares — cada uno con su pareja',
    izquierda: (n: number) => `Elemento ${n}`,
    derecha: (n: number) => `Pareja del elemento ${n}`,
    distractores: 'Respuestas de más',
    distractoresEditor: 'Respuestas de más (opcional) — una por línea',
  },
  ordenamiento: {
    consigna: 'Ordená con las flechas.',
    lista: 'Elementos para ordenar',
    subir: (texto: string) => `Subir: ${texto.slice(0, 60)}`,
    bajar: (texto: string) => `Bajar: ${texto.slice(0, 60)}`,
    iba: (lugar: number, texto: string) => `En el lugar ${lugar} iba: ${texto}`,
    editor: 'Elementos en el orden correcto — uno por línea',
    lugar: (n: number) => `Lugar ${n}`,
  },
  huecos: {
    consignaSeleccionar: 'Elegí la palabra de cada hueco.',
    consignaArrastrar: 'Tocá una palabra y después el hueco donde va.',
    elegir: 'Elegí…',
    hueco: (n: number) => `Hueco ${n}`,
    huecoCon: (n: number, palabra: string | null) => (palabra ? `Hueco ${n}: ${palabra}. Tocalo para sacarla.` : `Hueco ${n}: vacío`),
    banco: 'Palabras para poner',
    tocaPalabra: 'Tocá una palabra.',
    tocaHueco: (palabra: string) => `Ahora tocá el hueco donde va "${palabra}".`,
    correctas: (palabras: string[]) => `Correctas, en orden: ${palabras.join(' · ')}`,
    editorTexto: 'Texto — los huecos como [[1]], [[2]], [[3]]…',
    editorPalabras: 'Palabras — primero la de cada hueco, en orden; después las de más. Una por línea',
  },
  palabraFaltante: {
    editorTexto: 'Oración — el hueco como [[1]]',
  },
  calculada: {
    correcta: 'Correcta con estos valores',
    tolerancia: (t: number) => `se acepta ±${Math.round(t * 1000) / 10} %`,
    plantilla: 'Plantilla',
    formula: 'Fórmula',
    editorPlantilla: 'Enunciado — los datos como {a}, {b}…',
    editorFormula: 'Fórmula (como en Moodle: + - * / pow() sqrt()…)',
    editorRango: (nombre: string) => `Rango de {${nombre}}: mínimo y máximo`,
    noCierra: 'La fórmula o los comodines no cierran: revisalos. Mientras tanto, queda como estaba.',
    otrosValores: 'Sortear otros valores',
  },
  masTipos: {
    sugerido: 'Sugerido para esta materia',
    titulo: 'Más tipos (como en Moodle)',
    detalle: 'Se exportan a Moodle tal cual (Moodle XML). En GIFT, los que no existen ahí van adaptados.',
    elegidos: (n: number) => (n === 1 ? '1 elegido' : `${n} elegidos`),
  },
} as const

/** Ronda T · F1: exportar a Moodle, en XML o en GIFT. */
export const EXPORTAR_MOODLE = {
  boton: 'Exportar a Moodle',
  exportando: 'Exportando…',
  xml: 'Moodle XML (.xml)',
  xmlDetalle: 'Recomendado: lleva todos los tipos de pregunta.',
  gift: 'GIFT (.txt)',
  giftDetalle: 'El formato de siempre. No lleva ordenar ni arrastrar, y los gráficos van descriptos en texto.',
  listo: 'Exportación lista',
  seDescargo: (archivo: string) => `Se descargó ${archivo}`,
  noSePudo: 'No se pudo exportar',
} as const

/** Ronda T · C2: pagar desde la app (Mercado Pago Checkout Pro). */
export const PAGAR = {
  titulo: 'Pagar',
  resumen: 'Resumen',
  plan: 'Plan',
  precioDeLista: 'Precio',
  descuento: (porcentaje: number) => `Descuento (${porcentaje} %)`,
  total: 'Total',
  tenesUnCodigo: '¿Tenés un código?',
  aplicar: 'Aplicar',
  codigoAplicado: (codigo: string, porcentaje: number) => `${codigo}: ${porcentaje} % de descuento`,
  pagarConMercadoPago: 'Pagar con Mercado Pago',
  yendo: 'Te llevamos a Mercado Pago…',
  seguro: 'El pago lo procesa Mercado Pago. MaestrIA no ve ni guarda los datos de tu tarjeta.',
  entrar: 'Entrá con tu cuenta de docente para pagar',
  sinCheckout: 'Por ahora el pago es con el link de Mercado Pago.',
  sinPrecio: 'Ese plan todavía no tiene precio cargado.',
  montoCero: 'Con ese código no hay nada que pagar: escribile a Mauro y te lo acredita.',
  pedidoInvalido: 'Ese plan no existe.',
  linkFijo: 'Pagar con el link de Mercado Pago',
  linkFijoDetalle: 'Después de pagar, Mauro te acredita el plan a mano (suele ser en el día).',
  escribileAMauro: 'Escribile a Mauro para pagar con tu código',
  escribile: 'Escribile a Mauro',
  mensajeWhatsApp: (plan: string, codigo: string | null) =>
    `Hola, quiero pagar ${plan || 'un plan'} de MaestrIA${codigo ? ` con el código ${codigo}` : ''}.`,
  noSePudo: 'No pudimos armar el pago. Probá de nuevo en un rato.',
  // /precios/gracias
  gracias: {
    aprobado: 'Listo, tu pago se acreditó',
    aprobadoDetalle: 'Ya podés seguir con tu plan. Se ve en tu avatar, arriba a la derecha.',
    pendiente: 'Tu pago está en proceso',
    pendienteDetalle: 'Apenas Mercado Pago lo confirme, se acredita solo. No hace falta que hagas nada.',
    rechazado: 'El pago no se pudo hacer',
    rechazadoDetalle: 'Mercado Pago lo rechazó. Podés probar otra vez con otro medio de pago.',
    noEncontrado: 'No encontramos ese pago',
    volverAlPanel: 'Volver a mi panel',
    volverAPrecios: 'Volver a Precios',
    // E2: el pase por materia del alumno.
    aprobadoPase: 'Ya tenés el pase de esta materia: el plan completo y los simulacros hasta el examen.',
    volverAMiMateria: 'Volver a mi materia',
  },
  // Campanita y admin
  aviso: { titulo: 'Se acreditó tu pago', detalle: (descripcion: string) => descripcion || 'Tu plan ya está activo' },
  admin: {
    titulo: 'Últimos pagos',
    ninguno: 'Todavía no hay pagos desde la app.',
    estado: { pendiente: 'Pendiente', aprobado: 'Acreditado', rechazado: 'Rechazado', cancelado: 'Cancelado' },
  },
} as const

/** Ronda T · C1: /admin/codigos. */
export const CODIGOS_ADMIN = {
  titulo: 'Códigos de descuento',
  detalle: 'Un código baja el precio al pagar desde Precios. Un uso es una persona; quien ya lo usó lo vuelve a aplicar mientras duren sus meses.',
  faltaMigracion: 'Falta correr la migración 038 para usar los códigos.',
  noSePudo: 'No se pudieron leer los códigos.',
  crear: 'Crear un código',
  crearBoton: 'Crear',
  creando: 'Creando…',
  creado: 'Código creado.',
  ninguno: 'Todavía no hay códigos.',
  activo: 'Activo',
  inactivo: 'Desactivado',
  desactivar: 'Desactivar',
  activar: 'Volver a activar',
  marcaFundadora: 'marca Fundadora',
  usadoPor: 'Lo usaron:',
  aplica: { particular: 'Plan Particular', aula: 'Plan Aula', pase_alumno: 'Pase de alumno', todos: 'Todos los planes' },
  forma: { mensual: 'mensual', pase: 'pase', ambos: 'mensual o pase' },
  meses: (n: number) => (n === 1 ? 'por 1 mes' : `por ${n} meses`),
  sinLimiteDeMeses: 'sin límite de meses',
  usos: (hechos: number, maximos: number) => `${hechos} de ${maximos} ${maximos === 1 ? 'uso' : 'usos'}`,
  vence: (fecha: string) => `vence el ${fecha}`,
  campos: {
    codigo: 'Código',
    porcentaje: 'Descuento (%)',
    aplica: 'Para',
    forma: 'Forma',
    meses: 'Meses',
    usos: 'Usos',
    vence: 'Vence',
    fundadora: 'Marca Fundadora',
    nota: 'Nota',
    notaEjemplo: 'Para Silvana, primera fundadora',
  },
} as const

/** Ronda T · B1: lo que el plan gratis no tiene. */
export const PLANES_GRATIS = {
  verPlanes: 'Mirá los planes en Precios.',
  irAPrecios: 'Ver los planes',
} as const

/** Ronda T · A3: el área de la materia y el carácter de cada unidad. */
export const AREA_DE_LA_MATERIA = {
  renglon: (area: string, practicas: string) => `Área: ${area} · las preguntas prácticas van a ser ${practicas}`,
  nosParece: (area: string, practicas: string) => `Nos parece que es ${area} · las preguntas prácticas van a ser ${practicas}`,
  cambiar: 'Cambiar',
  cambiarArea: 'Cambiar el área de la materia',
  elegirArea: 'Área de la materia',
  caracter: { cuantitativo: 'Con cálculos', conceptual: 'Conceptual', mixto: 'Mixta' },
  caracterAyuda: {
    cuantitativo: 'Se evalúa con cálculos y problemas',
    conceptual: 'Se evalúa con conceptos y casos, sin cuentas',
    mixto: 'Conceptos y algo de cálculo',
  },
  cambiarCaracter: (unidad: string, actual: string) => `${unidad}: ${actual}. Cambiar cómo se evalúa`,
  elegirCaracter: 'Cómo se evalúa esta unidad',
  guardado: 'Listo, lo cambiamos.',
  noSeGuardo: 'No se pudo guardar. Probá de nuevo.',
  // A4: las tarjetas de modo del selector, según el área.
  modoTeorico: 'Conceptos, definiciones y relaciones entre ideas.',
  modoPractico: (practicas: string) => `Aplicar lo aprendido: ${practicas}.`,
  modoMixto: 'Las dos cosas en el mismo cuestionario.',
} as const

/** Ronda T · B2: el estado del plan en el avatar y en el menú de la cuenta. */
export const DISTINTIVO_DEL_PLAN = {
  planParticular: 'Plan Particular',
  planAula: 'Plan Aula',
  tope: 'tope',
  bloques: (n: number) => (n === 1 ? '1 bloque' : `${n} bloques`),
  cursos: (n: number) => (n === 1 ? '1 curso' : `${n} cursos`),
  deAlumnos: (usados: number, total: number) => `${usados} de ${total} alumnos`,
  deCuestionarios: (usados: number, total: number) => `${usados} de ${total} cuestionarios`,
  venceEl: (fecha: string) => `vence el ${fecha}`,
  venceEnDias: (dias: number) => (dias <= 0 ? 'Vence hoy' : dias === 1 ? 'Vence mañana' : `Vence en ${dias} días`),
  estadoPago: (plan: string) => plan.toLowerCase().replace('plan ', 'plan '),
  prueba: 'Prueba',
  pruebaQuedan: (dias: number) => (dias === 1 ? 'Prueba · queda 1 día' : `Prueba · quedan ${dias} días`),
  estadoPrueba: (dias: number) => (dias === 1 ? 'en prueba, queda 1 día' : `en prueba, quedan ${dias} días`),
  gratis: 'plan gratis',
  gratisTitulo: 'Plan gratis',
  teQuedan: (quedan: number, total: number) => `Te quedan ${quedan} de ${total} cuestionarios este mes`,
  estadoVencido: 'el plan venció',
  vencioTitulo: 'Tu plan venció',
  vencioDetalle: 'Tus alumnos sólo pueden ver',
  fundadora: 'Docente fundadora',
  elegirUnPlan: 'Elegir un plan',
  renovar: 'Renovar',
  pasateAUnPlan: 'Pasate a un plan',
  cupoEtiqueta: 'Cupo del plan',
} as const

/**
 * Ronda U · U1 — Los tipos pedidos que no salieron, con el porqué. El nombre
 * del tipo va en minúscula dentro de la frase ("de tipo calculada").
 */
export const TIPOS_PEDIDOS = {
  titulo: 'No salieron todos los tipos que pediste',
  sinCalculos: (tipo: string) => `No armamos preguntas de tipo ${tipo.toLowerCase()} porque esta unidad no tiene cálculos.`,
  noSalio: (tipo: string) => `No pudimos armar preguntas de tipo ${tipo.toLowerCase()} esta vez. Probá de nuevo o cambiá una a mano.`,
  noEntra: (tipos: string[]) =>
    `Pediste más tipos que preguntas: quedaron afuera ${tipos.map((t) => t.toLowerCase()).join(', ')}. Sumá preguntas para que entren todos.`,
} as const

/** Ronda V · V1: de qué canal llegó cada persona. */
export const ORIGEN = {
  porCanal: 'Por canal',
  porCanalDetalle: 'De qué link llegó cada persona (la primera visita). Los que se registraron sin link, o antes de que existiera, van en "sin dato".',
  columnas: { canal: 'Canal', docentes: 'Docentes', alumnos: 'Alumnos', conTarea: 'Mandaron una tarea', conAlumnos: 'Con alumnos' },
  sinDato: 'Sin dato',
  vacio: 'Todavía no hay nadie registrado.',
  canal: 'Canal',
  links: {
    titulo: 'Links para difundir',
    detalle: 'Un link por canal. Quien entra por ahí queda anotado con ese canal cuando se registra (30 días). Si es la recomendación de un docente, sumale su código.',
    ref: 'Código de referido (opcional)',
    copiar: 'Copiar',
    copiado: 'Copiado',
  },
} as const

/** Ronda V · V2: la materia de ejemplo. */
export const MATERIA_DE_EJEMPLO = {
  probar: 'Probar con una materia de ejemplo',
  titulo: 'Probá con una materia de ejemplo',
  detalle: 'Elegí un área y en un momento tenés una materia con un grupo de alumnos ficticios que ya respondieron una tarea y un diagnóstico. Así ves la ficha, el diagnóstico y la planilla sin cargar nada. No cuenta para tu plan y la borrás con un botón.',
  areas: {
    matematica: 'Matemática',
    economia: 'Economía',
    antropologia: 'Antropología',
    enfermeria: 'Enfermería',
    derecho: 'Derecho',
    didactica: 'Didáctica',
  },
  creando: 'Armando el ejemplo…',
  noSePudo: 'No se pudo armar el ejemplo. Probá de nuevo.',
  activo: (materia: string) => `Tenés la materia de ejemplo ${materia}. Los alumnos son ficticios: no cuentan para tu plan ni te avisan nada.`,
  verGrupo: 'Ver el grupo de ejemplo',
  borrar: 'Borrar el ejemplo',
  borrando: 'Borrando…',
  confirmar: '¿Borrar la materia de ejemplo? Se borran la materia, el grupo, los alumnos ficticios y sus respuestas. Lo tuyo no se toca.',
  cancelar: 'Cancelar',
  etiqueta: 'Ejemplo',
} as const

/** Ronda V · V3: los referidos. */
export const REFERIDOS = {
  titulo: 'Recomendá MaestrIA',
  detalle: 'Pasale tu link a otro docente. Si se registra con él y paga su primer plan, a vos te sumamos 30 días y a él le hacemos un 10 % de descuento en ese primer pago.',
  tuCodigo: 'Tu código',
  tuLink: 'Tu link',
  copiar: 'Copiar el link',
  copiado: 'Copiado',
  compartir: 'Mandarlo por WhatsApp',
  mensaje: (link: string) => `Estoy usando MaestrIA para armar las tareas y ver qué le falta a cada alumno. Si te registrás con este link, tenés 10 % de descuento en tu primer pago: ${link}`,
  resumen: (registrados: number, pagaron: number, dias: number) =>
    registrados === 0
      ? 'Todavía nadie se registró con tu link.'
      : `${registrados === 1 ? '1 docente se registró' : `${registrados} docentes se registraron`} con tu link; ${pagaron === 1 ? '1 pagó' : `${pagaron} pagaron`}. Ganaste ${dias} días.`,
  aviso: {
    titulo: 'Te sumamos 30 días',
    detalle: 'Un docente que se registró con tu link pagó su plan.',
  },
} as const

/** Ronda V · V4: el informe para el alumno y la familia. */
export const INFORME_FAMILIA = {
  compartir: 'Compartir informe',
  titulo: 'Compartir el informe',
  detalle: 'Armamos un link de sólo lectura, sin cuenta, con lo que practicó, lo que domina y lo que tiene que reforzar. No muestra notas de otros alumnos ni datos de contacto. Vence en 30 días y lo podés revocar cuando quieras.',
  proximosPasos: 'Próximos pasos (los lee la familia)',
  proximosPasosAyuda: 'Por ejemplo: "Repasar ecuaciones antes del parcial del viernes".',
  armar: 'Armar el link',
  armando: 'Armando…',
  listo: 'Listo. Este link se ve una sola vez: copialo o mandalo ahora.',
  copiar: 'Copiar el link',
  copiado: 'Copiado',
  whatsapp: 'Mandarlo por WhatsApp',
  mensaje: (nombre: string, link: string) => `Hola, te comparto cómo viene ${nombre} con la práctica: ${link}`,
  activos: 'Links activos',
  sinActivos: 'No hay links activos.',
  venceEl: (fecha: string) => `vence el ${fecha}`,
  visto: 'ya lo abrieron',
  noVisto: 'todavía no lo abrieron',
  revocar: 'Revocar',
  noSePudo: 'No se pudo armar el link. Probá de nuevo.',
  cerrar: 'Cerrar',
  pagina: {
    titulo: (nombre: string) => `Cómo viene ${nombre}`,
    materias: (materias: string) => `En ${materias}`,
    practico: (n: number) => (n === 0 ? 'Todavía no practicó.' : n === 1 ? 'Practicó 1 cuestionario.' : `Practicó ${n} cuestionarios.`),
    ultimaVez: (fecha: string) => `La última vez fue el ${fecha}.`,
    aciertos: (pct: number) => `En los últimos 30 días acertó el ${pct} % de las respuestas.`,
    dominados: 'Lo que ya domina',
    aReforzar: 'Lo que tiene que reforzar',
    enCamino: 'Lo que está practicando',
    nada: 'Todavía sin datos.',
    proximosPasos: 'Próximos pasos',
    pie: (fecha: string) => `Informe de sólo lectura armado con MaestrIA. Este link vale hasta el ${fecha}.`,
    noExiste: 'Este link no existe, venció o el docente lo revocó.',
    noExisteDetalle: 'Pedile al docente uno nuevo.',
  },
} as const

/** Ronda V · V5: la portada pública para los tres públicos. */
export const PORTADA = {
  titular: 'Tu alumno llega a la mesa sabiendo qué le falta',
  bajada: 'Cargás tu programa, MaestrIA arma las tareas de tu materia, sea cual sea, y te muestra tema por tema qué tiene que reforzar cada alumno. Ellos practican con explicaciones que les dicen en qué se equivocaron.',
  empezar: 'Empezar gratis',
  tengoCodigo: 'Tengo un código de mi profe',
  caminosTitulo: '¿Cuál es tu caso?',
  caminos: {
    particulares: {
      titulo: 'Doy clases particulares',
      detalle: 'Cada alumno con su ficha: qué practicó, qué domina y qué le falta. Le mandás tareas en un minuto y le compartís a la familia un informe de cómo viene.',
      boton: 'Empezar con mis alumnos',
      captura: 'La ficha de un alumno, con lo que domina y lo que tiene que reforzar',
    },
    curso: {
      titulo: 'Doy clases en un curso',
      detalle: 'Un grupo por curso, un diagnóstico para saber de dónde parte cada uno y la planilla con quién hizo qué. Exportás a Moodle cuando quieras.',
      boton: 'Empezar con mi curso',
      captura: 'El diagnóstico de un grupo, tema por tema',
    },
    examen: {
      titulo: 'Me preparo solo para un examen',
      detalle: 'Subís el programa de tu materia, ponés la fecha del examen y te armamos un plan con la práctica de cada día y simulacros cronometrados.',
      boton: 'Armar mi plan',
      captura: 'El plan hasta el examen, con la práctica del día',
    },
  },
  video: 'Mirá cómo funciona',
  testimonios: 'Lo que dicen los docentes',
  datosDeEjemplo: 'Las capturas son de una materia de ejemplo: los alumnos son ficticios.',
  entrar: 'Entrar',
} as const

/** Ronda V · V6: el centro de ayuda. */
export const AYUDA = {
  titulo: 'Ayuda',
  detalle: 'Guías cortas para usar MaestrIA. Las capturas son de una materia de ejemplo: los alumnos son ficticios.',
  volver: 'Todas las guías',
  comoFunciona: '¿Cómo funciona esto?',
  noEncontrada: 'Esa guía no existe.',
  otras: 'Otras guías',
} as const

/** Ronda W · W1: el banco de preguntas del docente. */
export const BANCO = {
  titulo: 'Banco de preguntas',
  detalle: 'Todas las preguntas de tus cuestionarios, sin repetidas. Buscalas y sumalas a una tarea nueva: la IA completa el resto.',
  abrir: 'Banco de preguntas',
  buscar: 'Buscar en el texto',
  todas: 'Todas',
  filtros: { materia: 'Materia', unidad: 'Unidad', tema: 'Tema', tipo: 'Tipo', valoracion: 'Valoración' },
  valoraciones: { arriba: 'Con pulgar arriba', abajo: 'Con pulgar abajo', sin: 'Sin valorar' },
  resultados: (n: number, total: number) => (n === total ? (n === 1 ? '1 pregunta' : `${n} preguntas`) : `${n} de ${total} preguntas`),
  vacio: 'No hay preguntas con esos filtros.',
  sinPreguntas: 'Todavía no tenés preguntas guardadas. Se suman solas cuando armás tareas.',
  deCuestionario: (titulo: string) => `De «${titulo}»`,
  cargando: 'Cargando el banco…',
  sumar: 'Sumar del banco',
  sumarCon: (n: number) => (n === 0 ? 'Sumar del banco' : n === 1 ? 'Del banco: 1 pregunta' : `Del banco: ${n} preguntas`),
  elegirTitulo: 'Elegí preguntas del banco',
  elegirDetalle: 'Las que elijas van en la tarea tal cual; la IA arma las que faltan para llegar a la cantidad, sin repetir.',
  soloTemas: 'Sólo de los temas elegidos',
  listo: 'Listo',
  quitarTodas: 'Quitar todas',
  elegir: (texto: string) => `Elegir: ${texto.slice(0, 60)}`,
} as const

/** Ronda W · W2: duplicar una tarea y mandarla a otro grupo. */
export const DUPLICAR_TAREA = {
  boton: 'Duplicar y mandar',
  botonGrupo: 'Duplicar a otro grupo',
  duplicando: 'Duplicando…',
  noSePudo: 'No se pudo duplicar la tarea. Probá de nuevo.',
} as const

/** Ronda W · W3: importar preguntas desde Moodle. */
export const IMPORTAR_MOODLE = {
  abrir: 'Importar de Moodle',
  titulo: 'Importar preguntas de Moodle',
  detalle: 'Subí un archivo GIFT o Moodle XML exportado de tu banco de Moodle. Te mostramos qué se puede traer y qué no, y por qué. Lo que importes queda como un cuestionario nuevo y en tu banco de preguntas.',
  materia: 'Materia',
  elegirMateria: 'Elegí la materia',
  archivo: 'Archivo (.gift, .txt o .xml)',
  leyendo: 'Leyendo el archivo…',
  formato: { gift: 'GIFT', xml: 'Moodle XML' },
  resumen: (n: number, salteadas: number, formato: string) =>
    `${formato}: ${n === 1 ? '1 pregunta se puede importar' : `${n} preguntas se pueden importar`}${salteadas ? `; ${salteadas === 1 ? '1 no' : `${salteadas} no`}` : ''}.`,
  seImportan: 'Se importan',
  noSeImportan: 'No se importan',
  tituloDelCuestionario: 'Nombre del cuestionario',
  tituloPorDefecto: (categoria: string | null) => `Importadas de Moodle${categoria ? ` · ${categoria}` : ''}`,
  guardar: (n: number) => (n === 1 ? 'Importar 1 pregunta' : `Importar ${n} preguntas`),
  guardando: 'Importando…',
  listo: 'Listo: quedaron en Mis tareas y en tu banco de preguntas.',
  verTareas: 'Ir a Mis tareas',
  verBanco: 'Ver el banco',
  vacio: 'El archivo no tiene preguntas que se puedan importar.',
  noSePudo: 'No se pudo guardar. Probá de nuevo.',
  otroArchivo: 'Elegir otro archivo',
} as const

/** Ronda W · W4: el examen impreso con temas A y B. */
export const EXAMEN_IMPRESO = {
  abrir: 'Imprimir temas A y B',
  volver: 'Mis tareas',
  imprimir: 'Imprimir',
  ayuda: 'Se imprime el tema A, el tema B y, en una hoja aparte, las respuestas de los dos. Para guardarlo en PDF, elegí "Guardar como PDF" en la impresora.',
  tema: (t: string) => `Tema ${t}`,
  alumno: 'Nombre y apellido',
  fecha: 'Fecha',
  curso: 'Curso',
  verdaderoFalso: 'Verdadero     Falso',
  respuesta: 'Respuesta:',
  unir: 'Escribí al lado de cada número la letra que le corresponde.',
  ordenar: 'Escribí el número de orden en cada casillero.',
  banco: 'Palabras:',
  variasCorrectas: 'Puede haber más de una correcta.',
  hojaDocente: 'Respuestas · para el docente',
  noEntregar: 'No se entrega a los alumnos.',
  noEncontrada: 'Esa tarea no existe o no es tuya.',
} as const

/** Ronda W · W5: la respuesta larga (ensayo) y su corrección. */
export const ENSAYO = {
  loQueSeEspera: 'Lo que se va a mirar en tu respuesta:',
  placeholder: 'Escribí tu respuesta con tus palabras…',
  tuRespuesta: 'Tu respuesta',
  palabras: (n: number) => (n === 1 ? '1 palabra' : `${n} palabras`),
  enCorreccion: 'En corrección',
  enCorreccionDetalle: 'Esta respuesta la corrige tu docente. Cuando la corrija, vas a ver la nota y su devolución. Mientras tanto no cuenta para tu nota.',
  enCorreccionCorto: 'En corrección: la corrige tu docente.',
  enCorreccionResultados: (n: number) => (n === 1 ? '1 respuesta larga en corrección: la nota es sin ella hasta que tu docente la corrija.' : `${n} respuestas largas en corrección: la nota es sin ellas hasta que tu docente las corrija.`),
  corregida: (nota: string) => `Corregida: ${nota}`,
  devolucionDelDocente: 'La devolución de tu docente',
  rubrica: {
    titulo: 'Rúbrica (de 3 a 5 criterios)',
    ayuda: 'Un criterio por renglón: lo que tiene que tener una buena respuesta.',
    proponer: 'Proponer criterios con IA',
    proponiendo: 'Pensando criterios…',
    noSePudo: 'No se pudieron proponer criterios. Escribilos vos o probá de nuevo.',
    faltan: 'Hacen falta de 3 a 5 criterios.',
  },
  correcciones: {
    abrir: (n: number) => (n === 0 ? 'Para corregir' : `Para corregir (${n})`),
    titulo: 'Respuestas para corregir',
    detalle: 'Las respuestas largas de tus alumnos. La IA te sugiere una nota y una devolución por criterio; vos la confirmás o la cambiás. El alumno la ve recién cuando confirmás.',
    vacio: 'No hay respuestas para corregir.',
    noDisponible: 'La corrección de respuestas largas todavía no está disponible.',
    alumno: 'Alumno',
    tarea: (t: string) => `En «${t}»`,
    consigna: 'Consigna',
    respuesta: 'Respuesta',
    guia: 'Lo que tendría una respuesta completa',
    sugerir: 'Sugerir con IA',
    sugiriendo: 'Corrigiendo…',
    noSePudoSugerir: 'No se pudo sugerir la corrección. Corregila vos o probá de nuevo.',
    niveles: { logrado: 'Logrado', parcial: 'Parcial', no_logrado: 'No logrado' },
    devolucionDelCriterio: 'Devolución',
    nota: 'Nota (0 a 10)',
    devolucionGeneral: 'Devolución para el alumno',
    confirmar: 'Confirmar y mostrar al alumno',
    confirmando: 'Guardando…',
    confirmada: 'Listo: el alumno ya la ve.',
    noSePudoConfirmar: 'No se pudo guardar la corrección.',
    sugerida: 'Sugerencia de la IA: revisala antes de confirmar.',
  },
} as const

/** Ronda X · X1: la pista antes de responder (sólo en la práctica). */
export const PISTA = {
  pedir: 'Pedir una pista',
  pensando: 'Pensando una pista…',
  titulo: 'Pista',
  tope: 'Ya usaste las pistas de hoy. Mañana tenés de nuevo.',
  sinPista: 'Para esta pregunta no hay una pista que no regale la respuesta. Probá con lo que sepas.',
  error: 'No se pudo pensar una pista. Probá de nuevo.',
} as const

/** Ronda X · X2: "Repasar hoy", el repaso espaciado de lo que te costó. */
export const REPASO = {
  titulo: 'Repasar hoy',
  detalle: (n: number) =>
    n === 1 ? '1 pregunta que te costó, para que no se te olvide.' : `${n} preguntas que te costaron, para que no se te olviden.`,
  empezar: 'Empezar el repaso',
  materia: 'Repaso del día',
  aviso: (n: number) => (n === 1 ? 'Tenés 1 pregunta para repasar hoy' : `Tenés ${n} preguntas para repasar hoy`),
  detalleAviso: 'Unos minutos alcanzan: vuelven las que te costaron.',
} as const

/** Ronda X · X4: la app instalable y sin conexión. */
export const PWA = {
  descripcion: 'Tareas y práctica con IA, para cualquier materia.',
  sinConexion: {
    titulo: 'Sin conexión',
    detalle: 'No hay internet en este momento. Cuando vuelva, seguí desde donde estabas: lo que respondiste queda guardado en este dispositivo hasta que se pueda enviar.',
    reintentar: 'Probar de nuevo',
  },
  instalar: {
    titulo: 'Instalá MaestrIA',
    detalle: 'Tenela a mano como una app más del celular o la compu, sin buscarla en el navegador.',
    boton: 'Instalar',
    ahoraNo: 'Ahora no',
    ios: 'En el iPhone: tocá Compartir y después "Agregar a inicio".',
  },
} as const

/** Ronda Y · Y1: la salud del sistema en /admin/salud y sus alertas. */
export const SALUD = {
  titulo: 'Salud del sistema',
  detalle: 'Las generaciones, el gasto de IA, los pagos para revisar y los errores. Se lee de la base; no cambia nada.',
  generaciones: {
    titulo: 'Generaciones (últimas 24 h)',
    total: 'Generaciones',
    fallidas: 'Fallidas',
    tasaDeFallas: 'Fallan',
    tasaDeDescarte: 'Descartan los validadores',
    sinDescarte: 'Sin dato (falta la migración 049)',
    ultimaHora: (fallidas: number, total: number) => `Última hora: ${fallidas} de ${total} fallidas`,
  },
  ia: {
    titulo: 'Gasto de IA',
    hoy: 'Hoy',
    mes: 'Este mes',
    porEndpoint: 'Últimas 24 h, por uso',
    columnas: { endpoint: 'Uso', llamadas: 'Llamadas', fallidas: 'Fallidas', usd: 'Gasto' },
  },
  pagos: {
    titulo: 'Pagos',
    sinTabla: 'Sin la migración 039 todavía no hay pagos.',
    ninguno: 'Ningún pago para revisar.',
    sinPagar: (n: number) => (n === 1 ? '1 pago iniciado sin pagar en la última semana (normal: alguien abrió el checkout y no siguió).' : `${n} pagos iniciados sin pagar en la última semana (normal: abrieron el checkout y no siguieron).`),
    motivo: { montoDistinto: 'Mercado Pago cobró otro monto', pendienteEnMercadoPago: 'Pendiente en Mercado Pago' },
    fila: (id: number, docente: string) => `Pago ${id} · ${docente}`,
  },
  errores: {
    titulo: 'Errores recientes',
    sinToken: 'Para verlos acá, cargá SENTRY_API_TOKEN (de sólo lectura) en Vercel. Mientras tanto:',
    ninguno: 'Ningún error sin resolver en las últimas 24 h.',
    abrirSentry: 'Abrir Sentry',
    veces: (n: number) => (n === 1 ? '1 vez' : `${n} veces`),
  },
  respaldo: {
    titulo: 'Respaldo diario',
    noConfigurado: (faltan: string) => `No está configurado: no se está haciendo. Falta cargar en Vercel ${faltan} (ver docs/backups.md §7).`,
    ninguno: 'Está configurado, pero todavía no hay ningún respaldo: el primero sale a las 3:30 (hora de Argentina).',
    ultimo: (fecha: string, tamano: string, cantidad: number) => `El último: ${fecha} (${tamano}). Hay ${cantidad === 1 ? '1 guardado' : `${cantidad} guardados`}; se guardan 14 días.`,
  },
  alertas: {
    generaciones: 'Fallan muchas generaciones',
    detalleGeneraciones: (fallidas: number, total: number) => `En la última hora fallaron ${fallidas} de ${total}.`,
    pago: 'Hay un pago para revisar',
    detallePago: (docente: string, motivo: string) => `${docente}: ${motivo}.`,
  },
} as const

/** Ronda Y · Y3: las novedades de MaestrIA. */
export const NOVEDADES = {
  titulo: 'Novedades de MaestrIA',
  detalle: 'Lo nuevo de la app, contado corto.',
  vacio: 'Todavía no hay novedades.',
  volver: 'Todas las novedades',
  leer: 'Leer',
  para: { todos: 'Para todos', docentes: 'Para docentes', alumnos: 'Para alumnos' },
  aviso: (titulo: string) => `Novedades de MaestrIA: ${titulo}`,
} as const
