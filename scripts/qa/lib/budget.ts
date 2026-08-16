/**
 * Techo de gasto de una corrida.
 *
 * El límite del lado de Anthropic (spend limit del workspace) es la red de
 * abajo: te frena la factura pero recién cuando ya se gastó, y con el mensaje
 * de error de la API, no con el tuyo. Éste es el freno de arriba: corta la
 * corrida en el momento y dice qué la estaba gastando.
 *
 * Existe por un escenario concreto: un loop accidental en el orquestador. Una
 * corrida normal de las cinco personas cuesta medio dólar; sólo un bucle puede
 * volver esto caro, y un bucle no se nota hasta que llega el resumen del mes.
 */

export const DEFAULT_MAX_USD = 5

export class BudgetExceededError extends Error {
  constructor(
    readonly spentUsd: number,
    readonly limitUsd: number,
    readonly lastLabel: string
  ) {
    super(
      `Techo de gasto superado: USD ${spentUsd.toFixed(4)} de un máximo de USD ${limitUsd.toFixed(2)}.\n` +
        `  Se cortó en: ${lastLabel}\n` +
        '  Si es esperado, volvé a correr con --max-usd=<monto>. Si no lo esperabas, revisá\n' +
        '  cuántas veces se está llamando al evaluador antes de subir el techo.'
    )
    this.name = 'BudgetExceededError'
  }
}

/**
 * Acumulador con corte. Se consulta DESPUÉS de cada llamada: no se puede saber
 * lo que va a costar una respuesta antes de tenerla, así que el techo se pasa
 * como mucho por el costo de una sola evaluación (~USD 0,10).
 */
export class Budget {
  private spent = 0

  constructor(private readonly limitUsd: number = DEFAULT_MAX_USD) {}

  add(costUsd: number, label: string): void {
    this.spent += costUsd
    if (this.spent > this.limitUsd) {
      throw new BudgetExceededError(this.spent, this.limitUsd, label)
    }
  }

  get totalUsd(): number {
    return Math.round(this.spent * 1_000_000) / 1_000_000
  }

  get remainingUsd(): number {
    return Math.max(0, this.limitUsd - this.spent)
  }

  summary(): string {
    return `USD ${this.totalUsd.toFixed(4)} gastados de un techo de USD ${this.limitUsd.toFixed(2)}`
  }
}
