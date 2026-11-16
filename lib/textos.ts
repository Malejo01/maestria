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
} as const

export const INVITADO = {
  aviso: 'Estás entrando como invitado. Creá tu cuenta para no perder tu progreso.',
  conCuenta: 'Con tu cuenta también vas a poder practicar por tu cuenta y ver cómo te va en cada tema.',
  crearCuenta: 'Crear mi cuenta',
} as const

export const CUENTA = {
  abrirMenu: 'Abrir el menú de tu cuenta',
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
    titulo: '¡Listo! Ya mandaste tu primera tarea.',
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
  ordenando: 'Separando las unidades y sus temas…',
  listo: (unidades: number, temas: number) =>
    `Listo: ${unidades} ${unidades === 1 ? 'unidad' : 'unidades'} y ${temas} ${temas === 1 ? 'tema' : 'temas'}. Revisalos abajo.`,
  fallo: 'No pudimos leer el archivo. Probá con otro.',
  progreso: 'Qué está pasando con tu archivo',
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
    titulo: '¡Listo! La tarea ya está en el grupo.',
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
