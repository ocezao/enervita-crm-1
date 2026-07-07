/**
 * ============================================================================
 * TESTE DE SINCRONIZAÇÃO — CSS ↔ TS
 * ============================================================================
 * tokens.ts declara explicitamente que é um espelho de tokens/*.css e que
 * divergência é pega em CI. Este arquivo é o que cumpre essa promessa.
 *
 * Estratégia: parseia os valores hex de colors.css via regex simples
 * (não precisa de um parser CSS completo — só precisamos extrair pares
 * "--nome: #hex") e compara contra o objeto `palette` exportado por
 * tokens.ts. Se alguém editar um valor em colors.css e esquecer de
 * espelhar em tokens.ts (ou vice-versa), este teste falha.
 *
 * Rodar com: npm test -- tokens.sync
 * ============================================================================
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { palette } from "../tokens";

function extractHexValues(cssContent: string): Record<string, string> {
  const result: Record<string, string> = {};
  const regex = /--palette-([a-z]+-\d+):\s*(#[0-9a-fA-F]{6});/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(cssContent)) !== null) {
    result[match[1]] = match[2].toLowerCase();
  }
  return result;
}

describe("Sincronização de tokens CSS ↔ TS", () => {
  const cssPath = join(__dirname, "../colors.css");
  const cssContent = readFileSync(cssPath, "utf-8");
  const cssValues = extractHexValues(cssContent);

  it("colors.css deve conter ao menos um valor de primitivo (sanity check do parser)", () => {
    expect(Object.keys(cssValues).length).toBeGreaterThan(0);
  });

  it("todo valor primitivo em colors.css tem equivalente em palette (tokens.ts)", () => {
    for (const [key, hexValue] of Object.entries(cssValues)) {
      const [family, shade] = key.split("-");
      const tsValue = (palette as Record<string, Record<string, string>>)[
        family
      ]?.[shade];

      expect(
        tsValue,
        `--palette-${key} existe em colors.css mas palette.${family}.${shade} não existe em tokens.ts`,
      ).toBeDefined();

      expect(
        tsValue?.toLowerCase(),
        `--palette-${key} = ${hexValue} em colors.css, mas palette.${family}.${shade} = ${tsValue} em tokens.ts (divergente)`,
      ).toBe(hexValue);
    }
  });

  it("todo valor em palette (tokens.ts) tem equivalente em colors.css (nenhum órfão)", () => {
    for (const [family, shades] of Object.entries(palette)) {
      for (const [shade, tsValue] of Object.entries(shades)) {
        const cssKey = `${family}-${shade}`;
        expect(
          cssValues[cssKey],
          `palette.${family}.${shade} = ${tsValue} existe em tokens.ts mas --palette-${cssKey} não foi encontrado em colors.css`,
        ).toBeDefined();
      }
    }
  });
});
