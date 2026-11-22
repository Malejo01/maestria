import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { DOCENTE, entrarComo } from './ayudas'
import { validarMoodleXml } from '../lib/moodle-xml-validar'

/**
 * Ronda T · F1: desde *Mis tareas*, "Exportar a Moodle" ofrece Moodle XML y
 * GIFT. El XML que se baja pasa el validador (lo que Moodle importa). No toca
 * la base ni la IA.
 */
test('Mis tareas: exportar a Moodle en XML baja un archivo que Moodle importa', async ({ page }) => {
  await entrarComo(page, DOCENTE)
  await page.goto('/teacher?seccion=tareas')
  const boton = page.getByRole('button', { name: 'Exportar a Moodle' }).first()
  await expect(boton).toBeVisible({ timeout: 30_000 })
  await boton.click()
  await expect(page.getByRole('menuitem', { name: /GIFT \(\.txt\)/ })).toBeVisible()
  const bajada = page.waitForEvent('download')
  await page.getByRole('menuitem', { name: /Moodle XML \(\.xml\)/ }).click()
  const archivo = await bajada
  expect(archivo.suggestedFilename()).toMatch(/\.xml$/)
  const xml = readFileSync(await archivo.path(), 'utf8')
  expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true)
  expect(validarMoodleXml(xml)).toEqual([])
})
