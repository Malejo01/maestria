'use client'

import { useState, type ChangeEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Upload } from 'lucide-react'
import type { ProgramUnit } from '@/lib/types'

export interface ProgramSourceMeta {
  sourceFileName: string
  sourceMimeType: string
  sourceFileSizeBytes: number
}

interface ProgramFileImportProps {
  /**
   * Called with the units the AI pulled out of the document. `anchorUnitName`
   * is set only for guided suggestions: it's the reference unit the teacher
   * typed, and the parent inserts the suggestion right after it so the guided
   * continuation lands where the document continues.
   */
  onUnitsSuggested: (units: ProgramUnit[], anchorUnitName?: string) => void
  onSourceMetaChange?: (meta: ProgramSourceMeta | null) => void
  disabled?: boolean
}

function sanitizeSuggestedUnits(input: unknown): ProgramUnit[] {
  if (!Array.isArray(input)) return []

  return input
    .map((unit, unitIndex) => {
      const raw = unit as Partial<ProgramUnit>
      const topics = Array.isArray(raw?.topics) ? raw.topics : []

      return {
        id: String(raw?.id || `import-u-${unitIndex + 1}`),
        name: String(raw?.name || '').trim(),
        topics: topics
          .map((topic, topicIndex) => ({
            id: String(topic?.id || `import-u-${unitIndex + 1}-t-${topicIndex + 1}`),
            name: String(topic?.name || '').trim(),
            // Anything read out of a document is the teacher's own material,
            // not a pick from the official curriculum.
            origin: 'custom' as const,
          }))
          .filter((topic) => topic.name.length > 0),
      }
    })
    .filter((unit) => unit.name.length > 0 && unit.topics.length > 0)
}

/**
 * Optional "import my syllabus" step of the subject wizard. Owns the whole
 * PDF/DOCX extraction conversation (upload → AI extract → optional guided
 * retry when confidence is low) and hands finished units back to the parent,
 * which decides where to merge them.
 */
export function ProgramFileImport({ onUnitsSuggested, onSourceMetaChange, disabled = false }: ProgramFileImportProps) {
  const { toast } = useToast()

  const [file, setFile] = useState<File | null>(null)
  const [sourceMeta, setSourceMeta] = useState<ProgramSourceMeta | null>(null)
  const [extractStage, setExtractStage] = useState('Listo para procesar')
  const [extractProgress, setExtractProgress] = useState(0)
  const [isExtracting, setIsExtracting] = useState(false)
  const [extractSummary, setExtractSummary] = useState<{
    extractionMethod: 'ai' | 'heuristic'
    extractionConfidence: number
    lowConfidence: boolean
    unitCount: number
    topicCount: number
  } | null>(null)

  const [showGuidePanel, setShowGuidePanel] = useState(false)
  const [guideUnitName, setGuideUnitName] = useState('')
  const [guideTopicOne, setGuideTopicOne] = useState('')
  const [guideTopicTwo, setGuideTopicTwo] = useState('')
  const [guideRejectedUnits, setGuideRejectedUnits] = useState<string[]>([])
  const [guideRejectedTopics, setGuideRejectedTopics] = useState<string[]>([])
  const [guideFeedbackNote, setGuideFeedbackNote] = useState('')
  const [guideRetryCount, setGuideRetryCount] = useState(0)
  const [isGuiding, setIsGuiding] = useState(false)
  const [guidePreviewUnits, setGuidePreviewUnits] = useState<ProgramUnit[] | null>(null)
  const [guideSummary, setGuideSummary] = useState<{
    extractionMethod: 'ai' | 'heuristic'
    strategy: 'semantic' | 'numbering' | 'hybrid'
    guideConfidence: number
    lowConfidence: boolean
    unitCount: number
    topicCount: number
  } | null>(null)

  const resetGuideState = () => {
    setShowGuidePanel(false)
    setGuideUnitName('')
    setGuideTopicOne('')
    setGuideTopicTwo('')
    setGuideRejectedUnits([])
    setGuideRejectedTopics([])
    setGuideFeedbackNote('')
    setGuideRetryCount(0)
    setGuidePreviewUnits(null)
    setGuideSummary(null)
  }

  const updateSourceMeta = (meta: ProgramSourceMeta | null) => {
    setSourceMeta(meta)
    onSourceMetaChange?.(meta)
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setFile(event.target.files?.[0] ?? null)
    updateSourceMeta(null)
    setExtractSummary(null)
    resetGuideState()
  }

  const toggleRejectedUnit = (name: string) => {
    const normalized = name.trim().toLowerCase()
    if (!normalized) return

    setGuideRejectedUnits((prev) =>
      prev.includes(normalized) ? prev.filter((item) => item !== normalized) : [...prev, normalized]
    )
  }

  const toggleRejectedTopic = (name: string) => {
    const normalized = name.trim().toLowerCase()
    if (!normalized) return

    setGuideRejectedTopics((prev) =>
      prev.includes(normalized) ? prev.filter((item) => item !== normalized) : [...prev, normalized]
    )
  }

  const isRejectedUnit = (name: string) => guideRejectedUnits.includes(name.trim().toLowerCase())
  const isRejectedTopic = (name: string) => guideRejectedTopics.includes(name.trim().toLowerCase())

  const handleExtract = async () => {
    if (!file) {
      toast({ title: 'Falta archivo', description: 'Selecciona un PDF, DOCX, DOC o imagen para autocompletar.' })
      return
    }

    setIsExtracting(true)
    updateSourceMeta(null)
    setExtractSummary(null)
    resetGuideState()
    setExtractProgress(8)
    setExtractStage('Subiendo archivo')

    try {
      const formData = new FormData()
      formData.append('file', file)

      setExtractProgress(24)
      setExtractStage('Leyendo contenido')

      const response = await fetch('/api/teacher/programs/extract', {
        method: 'POST',
        body: formData,
      })

      setExtractProgress(72)
      setExtractStage('Extrayendo unidades y temas con IA')

      const data = await response.json()
      if (!response.ok) {
        const detailMessage = data?.details ? ` (${data.details})` : ''
        throw new Error(`${data.error || 'No se pudo extraer el programa'}${detailMessage}`)
      }

      const extractedUnits = sanitizeSuggestedUnits(data.units)
      if (extractedUnits.length > 0) {
        onUnitsSuggested(extractedUnits)
      }

      updateSourceMeta({
        sourceFileName: data.sourceFileName,
        sourceMimeType: data.sourceMimeType,
        sourceFileSizeBytes: data.sourceFileSizeBytes,
      })

      setExtractSummary({
        extractionMethod: data.extractionMethod === 'heuristic' ? 'heuristic' : 'ai',
        extractionConfidence: Number(data.extractionConfidence || 0),
        lowConfidence: Boolean(data.lowConfidence),
        unitCount: Number(data?.summary?.unitCount || 0),
        topicCount: Number(data?.summary?.topicCount || 0),
      })

      if (Boolean(data.lowConfidence)) {
        const firstUnit = extractedUnits[0]
        setGuideUnitName(firstUnit?.name || '')
        setGuideTopicOne(firstUnit?.topics[0]?.name || '')
        setGuideTopicTwo(firstUnit?.topics[1]?.name || '')
        setShowGuidePanel(true)
      }

      setExtractProgress(100)
      setExtractStage('Validacion finalizada')

      const methodLabel = data.extractionMethod === 'heuristic' ? 'Heuristica' : 'IA'
      const confidencePercent = Math.round(Number(data.extractionConfidence || 0) * 100)
      toast({
        title: 'Autocompletado finalizado',
        description: `${data?.summary?.unitCount || 0} unidades, ${data?.summary?.topicCount || 0} temas. Metodo: ${methodLabel}. Confianza: ${confidencePercent}%`,
      })
    } catch (error) {
      toast({
        title: 'No se pudo procesar el archivo',
        description: error instanceof Error ? error.message : 'Error desconocido',
      })
    } finally {
      setIsExtracting(false)
      setTimeout(() => {
        setExtractProgress(0)
        setExtractStage('Listo para procesar')
      }, 900)
    }
  }

  const handleGuideAutocomplete = async () => {
    if (!sourceMeta?.sourceFileName) {
      toast({ title: 'Falta archivo fuente', description: 'Vuelve a ejecutar Autocompletar con IA para habilitar el guiado.' })
      return
    }

    const seedTopics = [guideTopicOne, guideTopicTwo].map((value) => value.trim()).filter((value) => value.length > 0)

    if (!guideUnitName.trim() || seedTopics.length < 2) {
      toast({ title: 'Datos insuficientes', description: 'Para guiar, completá 1 unidad y al menos 2 temas.' })
      return
    }

    setIsGuiding(true)

    try {
      const response = await fetch('/api/teacher/programs/guide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceFileName: sourceMeta.sourceFileName,
          seedUnitName: guideUnitName.trim(),
          seedTopics,
          rejectedUnitNames: guideRejectedUnits,
          rejectedTopicNames: guideRejectedTopics,
          guidanceNote: guideFeedbackNote.trim() || undefined,
          retryCount: guideRetryCount,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        const detailMessage = data?.details ? ` (${typeof data.details === 'string' ? data.details : 'revisá el formato'})` : ''
        throw new Error(`${data?.error || 'No se pudo guiar el autocompletado'}${detailMessage}`)
      }

      setGuidePreviewUnits(sanitizeSuggestedUnits(data.previewUnits))
      setGuideSummary({
        extractionMethod: data.extractionMethod === 'heuristic' ? 'heuristic' : 'ai',
        strategy: data.strategy === 'numbering' || data.strategy === 'hybrid' ? data.strategy : 'semantic',
        guideConfidence: Number(data.guideConfidence || 0),
        lowConfidence: Boolean(data.lowConfidence),
        unitCount: Number(data?.summary?.unitCount || 0),
        topicCount: Number(data?.summary?.topicCount || 0),
      })
      setGuideRetryCount((prev) => prev + 1)

      toast({
        title: 'Vista previa generada',
        description: `${data?.summary?.unitCount || 0} unidades y ${data?.summary?.topicCount || 0} temas listos para revisar.`,
      })
    } catch (error) {
      toast({
        title: 'No se pudo guiar el autocompletado',
        description: error instanceof Error ? error.message : 'Error desconocido',
      })
    } finally {
      setIsGuiding(false)
    }
  }

  const handleApplyGuidePreview = () => {
    if (!guidePreviewUnits || guidePreviewUnits.length === 0) {
      toast({ title: 'Sin vista previa', description: 'Genera una vista previa antes de aplicar cambios.' })
      return
    }

    onUnitsSuggested(guidePreviewUnits, guideUnitName.trim())
    toast({ title: 'Sugerencia aplicada', description: 'La estructura guiada se agrego a tu temario y podes editarla.' })
    resetGuideState()
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="program-file">Archivo del programa (PDF, DOCX, DOC, PNG o JPG, max 5MB)</Label>
        <Input
          id="program-file"
          type="file"
          accept=".pdf,.docx,.doc,.png,.jpg,.jpeg"
          onChange={handleFileChange}
          disabled={disabled}
        />
      </div>

      <Button type="button" variant="outline" onClick={handleExtract} disabled={disabled || isExtracting || !file}>
        {isExtracting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
        Autocompletar con IA
      </Button>

      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Estado: {extractStage}</span>
          <span>{extractProgress}%</span>
        </div>
        <div className="h-2 rounded bg-muted overflow-hidden">
          <div className="h-full bg-primary transition-all duration-300" style={{ width: `${extractProgress}%` }} />
        </div>
      </div>

      {sourceMeta && (
        <p className="text-sm text-muted-foreground">
          Archivo procesado: {sourceMeta.sourceFileName} (se conserva temporalmente 24h)
        </p>
      )}

      {extractSummary && (
        <p className={`text-sm ${extractSummary.lowConfidence ? 'text-amber-700' : 'text-emerald-700'}`}>
          Resultado: {extractSummary.unitCount} unidades y {extractSummary.topicCount} temas.
          Confianza estimada: {Math.round(extractSummary.extractionConfidence * 100)}%.
          Metodo: {extractSummary.extractionMethod === 'heuristic' ? 'Heuristica' : 'IA'}.
          {extractSummary.lowConfidence ? ' Revisa cuidadosamente porque hay baja confianza.' : ''}
        </p>
      )}

      {extractSummary?.lowConfidence && showGuidePanel && (
        <Card className="p-4 space-y-3 border-dashed">
          <h4 className="font-medium">Guiar autocompletado</h4>
          <p className="text-sm text-muted-foreground">
            Completa una unidad y dos temas de referencia. Se buscara en el documento y se sugeriran los contenidos siguientes.
          </p>

          <Input
            placeholder="Unidad de referencia"
            value={guideUnitName}
            onChange={(event) => setGuideUnitName(event.target.value)}
          />

          <div className="grid sm:grid-cols-2 gap-2">
            <Input
              placeholder="Tema de referencia 1"
              value={guideTopicOne}
              onChange={(event) => setGuideTopicOne(event.target.value)}
            />
            <Input
              placeholder="Tema de referencia 2"
              value={guideTopicTwo}
              onChange={(event) => setGuideTopicTwo(event.target.value)}
            />
          </div>

          <Textarea
            placeholder="Opcional: indicá qué partes salieron mal o qué querés que busque distinto"
            value={guideFeedbackNote}
            onChange={(event) => setGuideFeedbackNote(event.target.value)}
            rows={2}
          />

          <Button
            type="button"
            variant={guidePreviewUnits && guidePreviewUnits.length > 0 ? 'outline' : 'default'}
            onClick={handleGuideAutocomplete}
            disabled={isGuiding || !sourceMeta}
          >
            {isGuiding ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            {isGuiding
              ? 'Analizando documento...'
              : guidePreviewUnits && guidePreviewUnits.length > 0
                ? 'Actualizar vista previa con correcciones'
                : 'Generar vista previa guiada'}
          </Button>

          {guideSummary && (
            <p className={`text-sm ${guideSummary.lowConfidence ? 'text-amber-700' : 'text-emerald-700'}`}>
              Vista previa: {guideSummary.unitCount} unidades y {guideSummary.topicCount} temas.
              Confianza: {Math.round(guideSummary.guideConfidence * 100)}%.
              Metodo: {guideSummary.extractionMethod === 'heuristic' ? 'Heuristica' : 'IA'}.
              Estrategia: {guideSummary.strategy === 'hybrid' ? 'Hibrida' : guideSummary.strategy === 'numbering' ? 'Numeracion' : 'Similitud'}.
            </p>
          )}

          {guidePreviewUnits && guidePreviewUnits.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Vista previa antes de aplicar</p>
              <div className="max-h-56 overflow-y-auto rounded-md border p-2 space-y-2">
                {guidePreviewUnits.map((unit, unitIndex) => (
                  <div key={unit.id} className="text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">{unitIndex + 1}. {unit.name}</p>
                      <Button
                        type="button"
                        size="sm"
                        variant={isRejectedUnit(unit.name) ? 'default' : 'outline'}
                        onClick={() => toggleRejectedUnit(unit.name)}
                      >
                        {isRejectedUnit(unit.name) ? 'Unidad marcada como incorrecta' : 'Esta unidad esta mal'}
                      </Button>
                    </div>
                    <ul className="list-disc pl-5 text-muted-foreground">
                      {unit.topics.map((topic) => (
                        <li key={topic.id} className="flex items-center justify-between gap-2">
                          <span>{topic.name}</span>
                          <Button
                            type="button"
                            size="sm"
                            variant={isRejectedTopic(topic.name) ? 'default' : 'ghost'}
                            onClick={() => toggleRejectedTopic(topic.name)}
                          >
                            {isRejectedTopic(topic.name) ? 'Tema incorrecto' : 'Este tema esta mal'}
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <Button type="button" onClick={handleApplyGuidePreview}>
                Aplicar sugerencia
              </Button>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
