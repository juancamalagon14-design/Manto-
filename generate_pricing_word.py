import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import parse_xml, OxmlElement
from docx.oxml.ns import nsdecls, qn

def set_cell_shading(cell, color_hex):
    shading_elm = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{color_hex}"/>')
    cell._tc.get_or_add_tcPr().append(shading_elm)

def set_cell_margins(cell, top=120, bottom=120, left=150, right=150):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = OxmlElement('w:tcMar')
    for m, val in [('top', top), ('bottom', bottom), ('left', left), ('right', right)]:
        node = OxmlElement(f'w:{m}')
        node.set(qn('w:w'), str(val))
        node.set(qn('w:type'), 'dxa')
        tcMar.append(node)
    tcPr.append(tcMar)

def add_callout(doc, text, title="DOCTRINA ACTUARIAL", color_hex="F4F6F9", border_color="0A1C34"):
    tbl = doc.add_table(rows=1, cols=1)
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl.autofit = False
    tbl.columns[0].width = Inches(6.5)
    
    cell = tbl.cell(0, 0)
    set_cell_shading(cell, color_hex)
    set_cell_margins(cell, top=140, bottom=140, left=200, right=180)
    
    tcPr = cell._tc.get_or_add_tcPr()
    tcBorders = parse_xml(
        f'<w:tcBorders {nsdecls("w")}>'
        f'<w:top w:val="none"/>'
        f'<w:left w:val="single" w:sz="24" w:space="0" w:color="{border_color}"/>'
        f'<w:bottom w:val="none"/>'
        f'<w:right w:val="none"/>'
        f'</w:tcBorders>'
    )
    tcPr.append(tcBorders)
    
    p = cell.paragraphs[0]
    p.paragraph_format.space_before = Pt(2)
    p.paragraph_format.space_after = Pt(4)
    run_t = p.add_run(f"⚖️ {title}: ")
    run_t.font.name = 'Arial'
    run_t.font.size = Pt(10)
    run_t.font.bold = True
    run_t.font.color.rgb = RGBColor(10, 28, 52)
    
    run_txt = p.add_run(text)
    run_txt.font.name = 'Arial'
    run_txt.font.size = Pt(9.5)
    run_txt.font.color.rgb = RGBColor(10, 28, 52)
    
    doc.add_paragraph().paragraph_format.space_after = Pt(4)

def format_table(table, col_widths, navy_hex="0A1C34", light_hex="F8FAFC", alt_hex="FFFFFF"):
    for i, col in enumerate(table.columns):
        col.width = col_widths[i]
        
    for r_idx, row in enumerate(table.rows):
        for c_idx, cell in enumerate(row.cells):
            cell.width = col_widths[c_idx]
            cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
            set_cell_margins(cell, top=100, bottom=100, left=140, right=140)
            
            if r_idx == 0:
                set_cell_shading(cell, navy_hex)
                for p in cell.paragraphs:
                    p.paragraph_format.space_before = Pt(4)
                    p.paragraph_format.space_after = Pt(4)
                    for r in p.runs:
                        r.font.name = 'Arial'
                        r.font.size = Pt(9.5)
                        r.font.bold = True
                        r.font.color.rgb = RGBColor(255, 255, 255)
            else:
                shading = alt_hex if r_idx % 2 == 0 else light_hex
                set_cell_shading(cell, shading)
                for p in cell.paragraphs:
                    p.paragraph_format.space_before = Pt(3)
                    p.paragraph_format.space_after = Pt(3)
                    for r in p.runs:
                        r.font.name = 'Arial'
                        r.font.size = Pt(9)
                        r.font.color.rgb = RGBColor(10, 28, 52)

def generate_pricing_doc():
    doc = docx.Document()

    for s in doc.sections:
        s.top_margin = Inches(1.0)
        s.bottom_margin = Inches(1.0)
        s.left_margin = Inches(1.0)
        s.right_margin = Inches(1.0)

    navy = RGBColor(10, 28, 52)        # #0A1C34
    orange = RGBColor(207, 82, 36)     # #CF5224
    gray_muted = RGBColor(74, 90, 111) # #4A5A6F

    # ------------------ COVER / HEADER ------------------
    p_pre = doc.add_paragraph()
    p_pre.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r_pre = p_pre.add_run("MANTO SEGUROS DIGITALES • DOCUMENTO MAESTRO ACTUARIAL Y TÉCNICO")
    r_pre.font.name = 'Arial'
    r_pre.font.size = Pt(9)
    r_pre.font.bold = True
    r_pre.font.color.rgb = orange
    p_pre.paragraph_format.space_after = Pt(6)

    p_title = doc.add_paragraph()
    p_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r_title = p_title.add_run("MANUAL MAESTRO ACTUARIAL Y MATRIZ TÉCNICA DE TARIFICACIÓN V3")
    r_title.font.name = 'Arial'
    r_title.font.size = Pt(20)
    r_title.font.bold = True
    r_title.font.color.rgb = navy
    p_title.paragraph_format.space_after = Pt(6)

    p_sub = doc.add_paragraph()
    p_sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r_sub = p_sub.add_run("Especificación Canónica del Motor de Pricing • Justificación Clínica de Coberturas • Ley 1801 (SMLMV 2026) • Matriz de Add-ons y Descuentos")
    r_sub.font.name = 'Arial'
    r_sub.font.size = Pt(11)
    r_sub.font.italic = True
    r_sub.font.color.rgb = gray_muted
    p_sub.paragraph_format.space_after = Pt(16)

    # Metadata Banner
    tbl_meta = doc.add_table(rows=1, cols=4)
    tbl_meta.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl_meta.autofit = False
    widths_meta = [Inches(1.6), Inches(1.6), Inches(1.6), Inches(1.7)]
    format_table(tbl_meta, widths_meta, navy_hex="0A1C34", light_hex="0A1C34")
    
    meta_headers = ["Versión:", "Vigencia:", "Moneda Base:", "Actuario:"]
    meta_values = ["3.0.0-PROD", "2026 (Dec. 0159)", "COP Entero (BigInt)", "manto-pricing"]
    
    for idx, (h, v) in enumerate(zip(meta_headers, meta_values)):
        cell = tbl_meta.cell(0, idx)
        set_cell_shading(cell, "0A1C34")
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r1 = p.add_run(h + " ")
        r1.font.bold = True
        r1.font.size = Pt(8.5)
        r1.font.color.rgb = RGBColor(207, 82, 36)
        r2 = p.add_run(v)
        r2.font.bold = False
        r2.font.size = Pt(8.5)
        r2.font.color.rgb = RGBColor(255, 255, 255)

    doc.add_paragraph().paragraph_format.space_after = Pt(12)

    # ------------------ SECCIÓN 1 ------------------
    h1 = doc.add_heading(level=1)
    r_h1 = h1.add_run("1. Doctrinas Actuariales Fundacionales de Manto 2.0")
    r_h1.font.name = 'Arial'
    r_h1.font.size = Pt(14)
    r_h1.font.bold = True
    r_h1.font.color.rgb = navy
    h1.paragraph_format.space_before = Pt(14)
    h1.paragraph_format.space_after = Pt(6)

    p1 = doc.add_paragraph()
    p1.add_run(
        "El motor de tarificación de Manto 2.0 (Pricing Engine) está gobernado por cuatro principios técnicos inmutables "
        "diseñados para garantizar solvencia financiera, equidad contractual y cumplimiento regulatorio ante la Superintendencia Financiera de Colombia:\n\n"
        "1. Determinismo Absoluto (La IA Jamás Cotiza):\n"
        "Ningún modelo de lenguaje de gran escala (LLM como Google Gemini) ni algoritmo heurístico generativo posee atribuciones para calcular primas, "
        "establecer deducibles o autorizar pagos de siniestros. La IA en Manto opera única y exclusivamente como sensor de entrada estructurada "
        "(identificación visual de especie, raza fenotípica y extracción OCR de facturas DIAN y epicrisis). El cálculo de precios es 100% determinista, "
        "matemáticamente reproducible y ejecutado en el servidor bajo el servicio NestJS PricingService.\n\n"
        "2. Tipado Estricto Monetario (ColombianPeso / Cero Flotantes):\n"
        "Toda cifra dineraria se procesa en unidades monetarias enteras (COP) utilizando tipos fuertemente tipados (ColombianPeso / BigInt) "
        "con primitivas seguras toCop(), addCop() y multiplyCop(). Queda estrictamente prohibido el uso de números flotantes IEEE 754 "
        "para erradicar cualquier acumulación de errores de redondeo en operaciones financieras y prorrateos.\n\n"
        "3. Vinculación Canónica al SMLMV 2026 (Ley 1801 y Decreto 0159):\n"
        "El amparo legal de Responsabilidad Civil Extracontractual para razas de manejo especial se amarra formalmente al Salario Mínimo Legal "
        "Mensual Vigente fijado para 2026 en $1.750.905 COP, garantizando un límite exacto de $87.545.250 COP (50 SMLMV).\n\n"
        "4. Sincronización Estricta Deducible-Copago:\n"
        "El copago emitido en el contrato para coberturas de reembolso coincide de manera obligatoria y dinámica con el tramo de deducible "
        "contratado (10%, 15% o 20%), garantizando perfecta simetría entre el riesgo asumido por el tomador y la prima cobrada."
    )
    p1.runs[0].font.name = 'Arial'
    p1.runs[0].font.size = Pt(9.5)
    p1.paragraph_format.space_after = Pt(8)

    add_callout(
        doc,
        "La arquitectura del motor de tarificación desacopla la captura biomédica (Nuquí 🐾) de la lógica actuarial. "
        "Esto permite modificar tablas de mortalidad, factores de inflación médica y aranceles veterinarios sin alterar las interfaces del cliente.",
        title="DESACOPLAMIENTO ACTUARIAL"
    )

    # ------------------ SECCIÓN 2 ------------------
    h2 = doc.add_heading(level=1)
    r_h2 = h2.add_run("2. Justificación Clínica y Actuarial del Plan Base Universal ($4.750.000 COP)")
    r_h2.font.name = 'Arial'
    r_h2.font.size = Pt(14)
    r_h2.font.bold = True
    r_h2.font.color.rgb = navy
    h2.paragraph_format.space_before = Pt(14)
    h2.paragraph_format.space_after = Pt(6)

    p2 = doc.add_paragraph()
    p2.add_run(
        "Toda póliza de Manto 2.0 incluye de forma inherente un Plan Base Universal compuesto por tres amparos esenciales, "
        "calibrados con base en el análisis de costos hospitalarios reales en clínicas veterinarias de alta complejidad en Bogotá, Medellín y Cali:"
    )
    p2.runs[0].font.name = 'Arial'
    p2.runs[0].font.size = Pt(9.5)
    p2.paragraph_format.space_after = Pt(6)

    tbl_base = doc.add_table(rows=4, cols=5)
    tbl_base.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl_base.autofit = False
    widths_base = [Inches(1.8), Inches(1.3), Inches(0.9), Inches(0.9), Inches(1.6)]
    format_table(tbl_base, widths_base, navy_hex="0A1C34", light_hex="F8FAFC", alt_hex="FFFFFF")

    base_data = [
        ("Amparo Base Universal", "Límite Anual Asegurado", "Carencia", "¿Copago?", "Sustento Clínico Ponderado"),
        ("1. Urgencias & Hospitalización por Accidente", "$3.500.000 COP", "0 días", "10/15/20%", "Absorbe el 95.6% (P95) de costos por traumatismos severos, osteosíntesis y UCI."),
        ("2. Consultas Médicas de Urgencia Presencial", "$450.000 COP", "2 días", "10/15/20%", "3 eventos al año ($150.000 COP c/u). Distribución Poisson λ = 1.25 consultas/año."),
        ("3. Exámenes Diagnósticos de Choque", "$800.000 COP", "0 días", "10/15/20%", "Cubre Rx digital (3 vistas), ecografía FAST (A-FAST/T-FAST) y laboratorio de choque.")
    ]

    for r_idx, row in enumerate(base_data):
        for c_idx, val in enumerate(row):
            tbl_base.cell(r_idx, c_idx).paragraphs[0].text = val
    format_table(tbl_base, widths_base, navy_hex="0A1C34", light_hex="F8FAFC", alt_hex="FFFFFF")
    doc.add_paragraph().paragraph_format.space_after = Pt(8)

    p_base_det = doc.add_paragraph()
    p_base_det.add_run(
        "• Trauma Agudo y Cirugía Ortopédica: El análisis de severidad hospitalaria en clínicas como Dover o Kanicat indica que el costo medio "
        "de estabilización hemodinámica ($400k), osteosíntesis o laparotomía de choque ($1.9M), 3 días de UCI ($900k) y farmacia intrahospitalaria ($400k) "
        "alcanza los $3.420.000 COP en el percentil 95. El tope de $3.500.000 COP protege integralmente a la familia ante eventos catastróficos.\n"
        "• Diagnósticos Inmediatos de Choque: El límite de $800.000 COP permite practicar sin dilaciones el protocolo FAST ecográfico y radiológico "
        "necesario para definir la entrada a quirófano en minutos sin requerir autorizaciones telefónicas previas."
    )
    p_base_det.runs[0].font.name = 'Arial'
    p_base_det.runs[0].font.size = Pt(9)
    p_base_det.paragraph_format.space_after = Pt(8)

    # ------------------ SECCIÓN 3 ------------------
    h3 = doc.add_heading(level=1)
    r_h3 = h3.add_run("3. Marco Normativo de Responsabilidad Civil (Ley 1801 y SMLMV 2026)")
    r_h3.font.name = 'Arial'
    r_h3.font.size = Pt(14)
    r_h3.font.bold = True
    r_h3.font.color.rgb = navy
    h3.paragraph_format.space_before = Pt(14)
    h3.paragraph_format.space_after = Pt(6)

    p3 = doc.add_paragraph()
    p3.add_run(
        "El Artículo 127 de la Ley 1801 de 2016 (Código Nacional de Policía) estipula de forma imperativa que la póliza de Responsabilidad Civil "
        "Extracontractual para ejemplares caninos de manejo especial no podrá ser inferior a cincuenta (50) salarios mínimos legales mensuales vigentes.\n\n"
        "• Actualización Decreto 0159 del 19 de febrero de 2026: Fija transitoriamente el SMLMV en $1.750.905 COP.\n"
        "• Cálculo Obligatorio del Amparo: 50 × $1.750.905 = $87.545.250 COP exactos.\n\n"
        "Corrección del Déficit Histórico del Mercado:\n"
        "El mercado asegurador colombiano venía emitiendo pólizas con un valor desactualizado de $65.000.000 COP (50 SMLMV de 2024). En 2026, "
        "dicho monto representaba únicamente 37,1 SMLMV, configurando un déficit legal de 12,9 salarios mínimos ($22.545.250 COP) que exponía "
        "a los propietarios a sanciones policivas e invalidación del registro municipal. Manto 2.0 corrigió este déficit en código y emite el valor íntegro.\n\n"
        "Regla de Copago Cero para Terceros (0% Deducible):\n"
        "El amparo de RCE tiene copayApplies = false. La ley persigue la indemnización total de las víctimas por lesiones o daños materiales; "
        "imponer deducibles al tercero perjudicado violaría el orden público y generaría litigios residuales contra el titular."
    )
    p3.runs[0].font.name = 'Arial'
    p3.runs[0].font.size = Pt(9.5)
    p3.paragraph_format.space_after = Pt(8)

    # ------------------ SECCIÓN 4 ------------------
    h4 = doc.add_heading(level=1)
    r_h4 = h4.add_run("4. Catálogo Oficial de Razas de Manejo Especial (Ley 1801)")
    r_h4.font.name = 'Arial'
    r_h4.font.size = Pt(14)
    r_h4.font.bold = True
    r_h4.font.color.rgb = navy
    h4.paragraph_format.space_before = Pt(14)
    h4.paragraph_format.space_after = Pt(6)

    p4 = doc.add_paragraph()
    p4.add_run(
        "Las siguientes 15 razas caninas (y sus cruces o híbridos) cuentan con inyección automática del amparo de RCE por $87.545.250 COP "
        "y registro de sublímites fenotípicos en el motor de tarificación:"
    )
    p4.runs[0].font.name = 'Arial'
    p4.runs[0].font.size = Pt(9.5)
    p4.paragraph_format.space_after = Pt(6)

    tbl_razas = doc.add_table(rows=16, cols=5)
    tbl_razas.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl_razas.autofit = False
    widths_razas = [Inches(0.4), Inches(2.1), Inches(1.0), Inches(0.9), Inches(2.1)]
    format_table(tbl_razas, widths_razas, navy_hex="0A1C34", light_hex="F8FAFC", alt_hex="FFFFFF")

    razas_data = [
        ("#", "Raza Canónica (Ley 1801)", "Tamaño Típico", "Factor Raza", "Sublímite Clínico / Riesgo Fenotípico"),
        ("1", "American Pit Bull Terrier", "MEDIUM", "1.25", "Displasia de cadera y luxación patelar."),
        ("2", "American Staffordshire Terrier", "MEDIUM", "1.24", "Displasia coxofemoral y ataxia cerebelosa."),
        ("3", "Staffordshire Terrier", "MEDIUM", "1.24", "Cataratas hereditarias y aciduria L-2-HGA."),
        ("4", "Bull Terrier", "MEDIUM", "1.22", "Nefrotoxicidad hereditaria y sordera congénita."),
        ("5", "Bullmastiff", "GIANT", "1.28", "Torsión gástrica (GDV) y displasia articular severa."),
        ("6", "Dóberman", "LARGE", "1.22", "Cardiomiopatía dilatada (DCM) y espondilomielopatía."),
        ("7", "Dogo Argentino", "LARGE", "1.26", "Displasia coxofemoral y sordera neurosensorial."),
        ("8", "Dogo de Burdeos", "GIANT", "1.30", "Estenosis aórtica, dilatación gástrica y ectropión."),
        ("9", "Fila Brasileiro", "GIANT", "1.28", "Torsión gástrica y displasia coxofemoral y de codo."),
        ("10", "Mastín Napolitano", "GIANT", "1.30", "Prolapso glándula nictitante y displasia articular."),
        ("11", "Presa Canario / Dogo Canario", "LARGE", "1.28", "Displasia de cadera/codo y osteocondritis disecante."),
        ("12", "Rottweiler", "LARGE", "1.28", "Osteosarcoma, estenosis subaórtica y displasia."),
        ("13", "Tosa Japonés / Tosa Inu", "GIANT", "1.28", "Dilatación-torsión gástrica y displasia coxofemoral."),
        ("14", "American Bully", "MEDIUM", "1.25", "Síndrome braquiocefálico y displasia articular."),
        ("15", "Cane Corso / Mastín Italiano", "LARGE", "1.26", "Ectropión/entropión, displasia y torsión gástrica.")
    ]

    for r_idx, row in enumerate(razas_data):
        for c_idx, val in enumerate(row):
            tbl_razas.cell(r_idx, c_idx).paragraphs[0].text = val
    format_table(tbl_razas, widths_razas, navy_hex="0A1C34", light_hex="F8FAFC", alt_hex="FFFFFF")
    doc.add_paragraph().paragraph_format.space_after = Pt(8)

    # ------------------ SECCIÓN 5 ------------------
    h5 = doc.add_heading(level=1)
    r_h5 = h5.add_run("5. Algoritmo Actuarial y Matrices de Factores Multiplicadores")
    r_h5.font.name = 'Arial'
    r_h5.font.size = Pt(14)
    r_h5.font.bold = True
    r_h5.font.color.rgb = navy
    h5.paragraph_format.space_before = Pt(14)
    h5.paragraph_format.space_after = Pt(6)

    p5 = doc.add_paragraph()
    p5.add_run(
        "Fórmula de Cálculo Determinista:\n"
        "PrimaBaseCOP = round( BaseNominal × F(especie) × F(raza) × F(tamaño) × F(sexo) × F(edad) × F(ubicación) × F(deducible) × (1 - D(multimascota)) )\n"
        "PrimaMensualFinalCOP = PrimaBaseCOP + ∑ AddonsMensuales\n"
        "PrimaAnualFinalCOP = round( PrimaMensualFinalCOP × 11 )   (11 meses = 1 mes gratis por pago anticipado)"
    )
    p5.runs[0].font.name = 'Arial'
    p5.runs[0].font.size = Pt(9.5)
    p5.paragraph_format.space_after = Pt(8)

    # Factores detallados table
    tbl_multi = doc.add_table(rows=18, cols=4)
    tbl_multi.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl_multi.autofit = False
    widths_multi = [Inches(1.5), Inches(1.8), Inches(1.0), Inches(2.2)]
    format_table(tbl_multi, widths_multi, navy_hex="0A1C34", light_hex="F8FAFC", alt_hex="FFFFFF")

    multi_data = [
        ("Variable Actuarial", "Categoría / Tramo", "Factor", "Fundamento Actuarial"),
        ("Tasa Base Pura", "Base de tarificación", "$30.000 COP", "Tarifa de arranque estándar mensual."),
        ("Especie", "Canino (CANINE)", "1.00", "Línea base estándar."),
        ("Especie", "Felino (FELINE)", "0.92", "Menor exposición a trauma vial y vida intradomiciliaria."),
        ("Tamaño Efectivo", "Toy (≤ 5 kg)", "0.92", "Menor dosimetría anestésica y fármacos por peso."),
        ("Tamaño Efectivo", "Small (5 - 10 kg)", "0.96", "Riesgo estándar bajo."),
        ("Tamaño Efectivo", "Medium (10 - 25 kg)", "1.00", "Línea base neutra."),
        ("Tamaño Efectivo", "Large (25 - 45 kg)", "1.08", "Mayor costo quirúrgico y predisposición articular."),
        ("Tamaño Efectivo", "Giant (> 45 kg)", "1.18", "Alta dosimetría, riesgo de GDV y corta esperanza de vida."),
        ("Sexo", "Macho (MALE)", "1.03", "Mayor prevalencia de trauma por conducta y patología prostática."),
        ("Sexo", "Hembra (FEMALE)", "1.00", "Línea base neutra."),
        ("Edad en Meses", "2 a 12 meses (Cachorro/Gatito)", "0.95", "Buena respuesta biológica y bajo riesgo degenerativo."),
        ("Edad en Meses", "13 a 36 meses (Adulto Joven)", "1.00", "Línea base neutra."),
        ("Edad en Meses", "37 a 72 meses (Adulto Pleno)", "1.10", "Aparición de afecciones crónicas iniciales."),
        ("Edad en Meses", "73 a 96 meses (Adulto Maduro)", "1.30", "Frecuencia creciente de consultas y estudios."),
        ("Edad en Meses", "97 a 120 meses (Senior)", "1.60", "Alta frecuencia de patologías degenerativas."),
        ("Edad en Meses", "121 a 144 meses (Geriátrico)", "1.90", "Tope máximo de edad admitido para nuevo ingreso."),
        ("Ubicación", "Bogotá D.C.", "1.08", "Aranceles veterinarios más altos del país."),
    ]

    for r_idx, row in enumerate(multi_data):
        for c_idx, val in enumerate(row):
            tbl_multi.cell(r_idx, c_idx).paragraphs[0].text = val
    format_table(tbl_multi, widths_multi, navy_hex="0A1C34", light_hex="F8FAFC", alt_hex="FFFFFF")
    doc.add_paragraph().paragraph_format.space_after = Pt(8)

    # ------------------ SECCIÓN 6 ------------------
    h6 = doc.add_heading(level=1)
    r_h6 = h6.add_run("6. Matriz Completa de Add-ons y Reglas de Interacción de Copago")
    r_h6.font.name = 'Arial'
    r_h6.font.size = Pt(14)
    r_h6.font.bold = True
    r_h6.font.color.rgb = navy
    h6.paragraph_format.space_before = Pt(14)
    h6.paragraph_format.space_after = Pt(6)

    tbl_addons = doc.add_table(rows=8, cols=6)
    tbl_addons.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl_addons.autofit = False
    widths_addons = [Inches(1.8), Inches(1.0), Inches(1.2), Inches(0.7), Inches(0.6), Inches(1.2)]
    format_table(tbl_addons, widths_addons, navy_hex="0A1C34", light_hex="F8FAFC", alt_hex="FFFFFF")

    addons_data = [
        ("Amparo Opcional (Add-on)", "Prima Mensual", "Límite Anual", "Carencia", "¿Copago?", "Comportamiento Liquidación"),
        ("Enfermedades Comunes e Infecciosas", "$24.900 COP", "$5.000.000 COP", "30 días", "SÍ", "Aplica 10%, 15% o 20% según deducible."),
        ("Medicamentos Recetados Ambulatorios", "$12.900 COP", "$600.000 COP", "30 días", "SÍ", "Aplica 10%, 15% o 20% según deducible."),
        ("Pack Bienestar: Vacunas y Desparasitación", "$14.900 COP", "$350.000 COP", "0 días", "NO", "Reembolso del 100% de la factura."),
        ("Responsabilidad Civil Ley 1801 (50 SMLMV)", "$15.000 COP", "$87.545.250 COP", "0 días", "NO", "0% Copago. Indemnización íntegra a terceros."),
        ("Asistencia Exequial y Cremación", "$9.900 COP", "$1.200.000 COP", "30 días", "NO", "Servicio integral directo con funeraria aliada."),
        ("Telemedicina Veterinaria 24/7", "$6.900 COP", "Ilimitado", "0 días", "NO", "Videollamadas ilimitadas sin cobro por evento."),
        ("Guardería por Titular Hospitalizado", "$4.900 COP", "$800.000 COP (10d)", "15 días", "NO", "Hasta $80.000 COP/día por hasta 10 días continuos.")
    ]

    for r_idx, row in enumerate(addons_data):
        for c_idx, val in enumerate(row):
            tbl_addons.cell(r_idx, c_idx).paragraphs[0].text = val
    format_table(tbl_addons, widths_addons, navy_hex="0A1C34", light_hex="F8FAFC", alt_hex="FFFFFF")
    doc.add_paragraph().paragraph_format.space_after = Pt(8)

    # ------------------ SECCIÓN 7 ------------------
    h7 = doc.add_heading(level=1)
    r_h7 = h7.add_run("7. Tramos de Deducible y Monotonía de Precios")
    r_h7.font.name = 'Arial'
    r_h7.font.size = Pt(14)
    r_h7.font.bold = True
    r_h7.font.color.rgb = navy
    h7.paragraph_format.space_before = Pt(14)
    h7.paragraph_format.space_after = Pt(6)

    tbl_ded = doc.add_table(rows=4, cols=4)
    tbl_ded.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl_ded.autofit = False
    widths_ded = [Inches(1.5), Inches(1.3), Inches(1.8), Inches(1.9)]
    format_table(tbl_ded, widths_ded, navy_hex="0A1C34", light_hex="F8FAFC", alt_hex="FFFFFF")

    ded_data = [
        ("Tramo Deducible", "Factor Actuarial", "Impacto en Prima Base", "Aporte del Tomador en Siniestro"),
        ("10%", "1.15", "+15% sobre tarifa neutra", "10% a cargo del titular (Manto paga 90%)"),
        ("15%", "1.00", "0% (Tarifa neutra base)", "15% a cargo del titular (Manto paga 85%)"),
        ("20%", "0.88", "-12% de descuento", "20% a cargo del titular (Manto paga 80%)")
    ]

    for r_idx, row in enumerate(ded_data):
        for c_idx, val in enumerate(row):
            tbl_ded.cell(r_idx, c_idx).paragraphs[0].text = val
    format_table(tbl_ded, widths_ded, navy_hex="0A1C34", light_hex="F8FAFC", alt_hex="FFFFFF")
    doc.add_paragraph().paragraph_format.space_after = Pt(12)

    # ------------------ SECCIÓN 8 ------------------
    h8 = doc.add_heading(level=1)
    r_h8 = h8.add_run("8. Certificación y Trazabilidad en Código Fuente")
    r_h8.font.name = 'Arial'
    r_h8.font.size = Pt(14)
    r_h8.font.bold = True
    r_h8.font.color.rgb = navy
    h8.paragraph_format.space_before = Pt(14)
    h8.paragraph_format.space_after = Pt(6)

    p8 = doc.add_paragraph()
    p8.add_run(
        "Toda la formulación actuarial descrita se encuentra respaldada por pruebas automatizadas en Jest que garantizan cero regresiones:\n"
        "• Suite de Pruebas Actuariales: backend/src/modules/pricing/pricing.actuarial.spec.ts\n"
        "• Suite de Validación de DTOs y Esquemas: backend/src/modules/pricing/pricing.validation.spec.ts\n"
        "• Archivo Canónico de Constantes: backend/src/modules/pricing/pricing.constants.ts\n"
        "• Implementación de Algoritmo de Cálculo: backend/src/modules/pricing/pricing.service.ts"
    )
    p8.runs[0].font.name = 'Arial'
    p8.runs[0].font.size = Pt(9.5)
    p8.paragraph_format.space_after = Pt(16)

    # Footer
    p_foot = doc.add_paragraph()
    p_foot.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r_foot = p_foot.add_run("© 2026 Manto Seguros Digitales S.A.S. • Aprobado por manto-pricing • Documento Actuarial Confidencial")
    r_foot.font.name = 'Arial'
    r_foot.font.size = Pt(8)
    r_foot.font.italic = True
    r_foot.font.color.rgb = gray_muted

    target_path = r"e:\Manto 2.0\Información relevante\03_MANTO_MANUAL_ACTUARIAL_Y_TARIFICACION_PRECIOS_V3.docx"
    doc.save(target_path)
    print(f"Documento generado exitosamente en: {target_path}")

if __name__ == "__main__":
    generate_pricing_doc()
