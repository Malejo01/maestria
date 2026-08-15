/**
 * Cliente mínimo de la API de Neon: sólo lo que hace falta para crear, consultar
 * y —sobre todo— BORRAR una branch.
 *
 * `deleteBranch` es la razón de que este módulo exista. El procedimiento de
 * staging clona producción con datos reales de 31 alumnos identificables, y el
 * `finally` que limpia esa branch no puede depender de que alguien abra la
 * consola de Neon. Todo lo demás acá está para que ese borrado tenga a qué
 * apuntar.
 */

const NEON_API_BASE = 'https://console.neon.tech/api/v2'

export interface NeonBranch {
  id: string
  name: string
  /** Neon marca así la branch raíz; en proyectos viejos venía como `primary`. */
  default?: boolean
  primary?: boolean
  parent_id?: string
}

export interface NeonEndpoint {
  id: string
  branch_id: string
  type: string
  host: string
}

export class NeonApiError extends Error {
  constructor(
    readonly status: number,
    readonly method: string,
    readonly path: string,
    body: string,
  ) {
    // El cuerpo se trunca: la API repite parámetros de la request en el error y
    // no hay garantía de que no aparezca algo sensible en un caso raro.
    super(`Neon API ${method} ${path} → ${status}: ${body.slice(0, 300)}`)
    this.name = 'NeonApiError'
  }
}

export class NeonApi {
  constructor(
    private readonly apiKey: string,
    private readonly projectId: string,
  ) {
    if (!apiKey) throw new Error('NEON_API_KEY vacía.')
    if (!projectId) throw new Error('NEON_PROJECT_ID vacío.')
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${NEON_API_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })

    if (!response.ok) {
      throw new NeonApiError(response.status, method, path, await response.text().catch(() => ''))
    }

    // DELETE devuelve cuerpo, pero no vale la pena depender de eso.
    const text = await response.text()
    return (text ? JSON.parse(text) : {}) as T
  }

  async listBranches(): Promise<NeonBranch[]> {
    const data = await this.request<{ branches: NeonBranch[] }>(
      'GET',
      `/projects/${this.projectId}/branches`,
    )
    return data.branches ?? []
  }

  /**
   * La branch de la que se clona. Se busca por la marca de raíz del proyecto y
   * no por nombre: el nombre por defecto cambió de `main` a `production` según
   * la época en que se creó el proyecto, y clonar la branch equivocada daría un
   * staging con datos que no son los de producción — un falso "todo limpio".
   */
  async findDefaultBranch(): Promise<NeonBranch> {
    const branches = await this.listBranches()
    const root = branches.find((branch) => branch.default || branch.primary)
    if (root) return root

    const byName = branches.find((branch) => branch.name === 'production' || branch.name === 'main')
    if (byName) return byName

    throw new Error(
      `No se pudo identificar la branch raíz del proyecto ${this.projectId}. ` +
        `Branches encontradas: ${branches.map((b) => b.name).join(', ') || '(ninguna)'}`,
    )
  }

  async findBranchByName(name: string): Promise<NeonBranch | undefined> {
    return (await this.listBranches()).find((branch) => branch.name === name)
  }

  /**
   * Crea la branch con datos al momento de la llamada.
   *
   * Sin `parent_lsn` ni `parent_timestamp`: omitirlos es lo que significa "hasta
   * ahora" para la API, el equivalente del *Include data up to → Now* de la
   * consola. Es copy-on-write, así que tarda segundos y no ocupa almacenamiento
   * extra al principio.
   */
  async createBranch(name: string, parentId: string): Promise<{ branch: NeonBranch; endpoints: NeonEndpoint[] }> {
    return this.request<{ branch: NeonBranch; endpoints: NeonEndpoint[] }>(
      'POST',
      `/projects/${this.projectId}/branches`,
      {
        branch: { name, parent_id: parentId },
        endpoints: [{ type: 'read_write' }],
      },
    )
  }

  async deleteBranch(branchId: string): Promise<void> {
    await this.request('DELETE', `/projects/${this.projectId}/branches/${branchId}`)
  }

  /**
   * URI de conexión de la branch. Se pide a la API en vez de armarla a mano
   * sustituyendo el host en la de producción: la contraseña del rol puede
   * diferir por branch, y una URI construida a mano fallaría al conectar o —peor—
   * conectaría a producción si la sustitución no acierta.
   */
  async getConnectionUri(params: {
    branchId: string
    database: string
    role: string
    pooled: boolean
  }): Promise<string> {
    const query = new URLSearchParams({
      branch_id: params.branchId,
      database_name: params.database,
      role_name: params.role,
      pooled: String(params.pooled),
    })

    const data = await this.request<{ uri: string }>(
      'GET',
      `/projects/${this.projectId}/connection_uri?${query.toString()}`,
    )

    if (!data.uri) throw new Error('La API de Neon no devolvió una connection URI.')
    return data.uri
  }
}
