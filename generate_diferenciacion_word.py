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

def add_callout(doc, text, title="NOTA ESTRATÉGICA", color_hex="F4F6F9", border_color="CF5224"):
    tbl = doc.add_table(rows=1, cols=1)
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl.autofit = False
    tbl.columns[0].width = Inches(6.5)
    
    cell = tbl.cell(0, 0)
    set_cell_shading(cell, color_hex)
    set_cell_margins(cell, top=140, bottom=140, left=200, right=180)
    
    # Left border only
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
    run_t = p.add_run(f"📌 {title}: ")
    run_t.font.name = 'Arial'
    run_t.font.size = Pt(10)
    run_t.font.bold = True
    run_t.font.color.rgb = RGBColor(207, 82, 36)
    
    run_txt = p.add_run(text)
    run_txt.font.name = 'Arial'
    run_txt.font.size = Pt(9.5)
    run_txt.font.color.rgb = RGBColor(10, 28, 52)
    
    doc.add_paragraph().paragraph_format.space_after = Pt(4)

def format_table_headers_and_borders(table, col_widths, navy_hex="0A1C34", light_hex="F8FAFC", alt_hex="FFFFFF"):
    for i, col in enumerate(table.columns):
        col.width = col_widths[i]
        
    for r_idx, row in enumerate(table.rows):
        for c_idx, cell in enumerate(row.cells):
            cell.width = col_widths[c_idx]
            cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
            set_cell_margins(cell, top=100, bottom=100, left=140, right=140)
            
            # Shading
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

def generate_document():
    doc = docx.Document()

    # 1-inch margins
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
    r_pre = p_pre.add_run("MANTO SEGUROS DIGITALES • DOCUMENTO EJECUTIVO DE ESTRATEGIA Y PRODUCTO")
    r_pre.font.name = 'Arial'
    r_pre.font.size = Pt(9)
    r_pre.font.bold = True
    r_pre.font.color.rgb = orange
    p_pre.paragraph_format.space_after = Pt(6)

    p_title = doc.add_paragraph()
    p_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r_title = p_title.add_run("DIFERENCIACIÓN ESTRATÉGICA, BENCHMARK GLOBAL Y MODELO ACTUARIAL DE TARIFICACIÓN")
    r_title.font.name = 'Arial'
    r_title.font.size = Pt(20)
    r_title.font.bold = True
    r_title.font.color.rgb = navy
    p_title.paragraph_format.space_after = Pt(6)

    p_sub = doc.add_paragraph()
    p_sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r_sub = p_sub.add_run("Por qué Manto es diferente • Lecciones de Éxito de Lemonade y Tuio • Crítica del Mercado en Colombia • Matriz de Precios V3 y Ley 1801 de 2016")
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
    format_table_headers_and_borders(tbl_meta, widths_meta, navy_hex="0A1C34", light_hex="0A1C34")
    
    meta_headers = ["Mercado:", "Vigencia:", "Versión:", "Enfoque:"]
    meta_values = ["Colombia (Mascotas)", "2026 (Decreto 0159)", "3.0.0-PROD", "Insurtech MGA"]
    
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
    r_h1 = h1.add_run("1. Resumen Ejecutivo y Tesis de Negocio")
    r_h1.font.name = 'Arial'
    r_h1.font.size = Pt(14)
    r_h1.font.bold = True
    r_h1.font.color.rgb = navy
    h1.paragraph_format.space_before = Pt(14)
    h1.paragraph_format.space_after = Pt(6)

    p1 = doc.add_paragraph()
    p1.add_run(
        "En Colombia, más del 60% de los hogares urbanos conviven con al menos una mascota, representando un universo superior a los "
        "5 millones de perros y gatos en estratos 3 al 6. No obstante, menos del 3% cuenta con una póliza de seguro de gastos médicos formal. "
        "El costo promedio de una urgencia médica veterinaria o intervención quirúrgica oscila entre $600.000 y $4.500.000 COP, "
        "constituyendo un impacto financiero imprevisto de alta gravedad para las familias colombianas.\n\n"
        "Manto 2.0 se erige como la primera plataforma insurtech nativa digital para mascotas en Colombia concebida bajo la doctrina de "
        "Simplicidad Radical, Transparencia Contractual y Velocidad Extrema. Combina una experiencia de usuario inspirada en las "
        "neoseguradoras globales más exitosas con una ingeniería adaptada de raíz a la realidad tributaria (Facturación Electrónica DIAN con CUFE), "
        "financiera (Bre-B, Nequi, dispersión interbancaria instantánea) y regulatoria de Colombia (Ley 1801 de 2016 y Ley 1581 de 2012)."
    )
    p1.runs[0].font.name = 'Arial'
    p1.runs[0].font.size = Pt(10)
    p1.paragraph_format.space_after = Pt(8)

    add_callout(
        doc,
        "Manto no es un corredor tradicional con una página web moderna, ni un broker que revende productos ajenos con margen inflado. "
        "Es una plataforma tecnológica MGA (Managing General Agent) con motor de suscripción algorítmico, libre elección de clínicas y liquidación automatizada.",
        title="TESIS CENTRAL DE MANTO 2.0"
    )

    # ------------------ SECCIÓN 2 ------------------
    h2 = doc.add_heading(level=1)
    r_h2 = h2.add_run("2. Benchmark Internacional: ¿Qué Hizo Exitosos a Lemonade y Tuio?")
    r_h2.font.name = 'Arial'
    r_h2.font.size = Pt(14)
    r_h2.font.bold = True
    r_h2.font.color.rgb = navy
    h2.paragraph_format.space_before = Pt(14)
    h2.paragraph_format.space_after = Pt(6)

    p2 = doc.add_paragraph()
    p2.add_run(
        "El éxito de las neoseguradoras a nivel global no radicó únicamente en tener una interfaz atractiva, sino en replantear "
        "los incentivos estructurales y los puntos de fricción más dolorosos del seguro tradicional."
    )
    p2.runs[0].font.name = 'Arial'
    p2.runs[0].font.size = Pt(10)

    # Lemonade Sub
    h2_1 = doc.add_heading(level=2)
    r_h2_1 = h2_1.add_run("2.1 Lemonade (EE.UU. y Europa) — El Fin del Conflicto de Interés")
    r_h2_1.font.name = 'Arial'
    r_h2_1.font.size = Pt(12)
    r_h2_1.font.bold = True
    r_h2_1.font.color.rgb = orange
    h2_1.paragraph_format.space_before = Pt(8)
    h2_1.paragraph_format.space_after = Pt(4)

    p_lem = doc.add_paragraph()
    p_lem.add_run(
        "• Modelo Giveback (Alineación de Incentivos): En el seguro tradicional, cada peso no pagado en un siniestro va directamente "
        "a la utilidad neta de la aseguradora, lo que genera un incentivo perverso para demorar o rechazar reclamos. Lemonade cobra una tarifa plana fija "
        "(aprox. 25-30%) para operar y pagar reaseguro. El remanente alimenta un fondo común de siniestros; el dinero sobrante anual no se retiene "
        "como beneficio empresarial, sino que se dona a causas benéficas elegidas por los propios clientes. Esto transformó la desconfianza en lealtad.\n\n"
        "• Automatización Total con IA (AI Maya y AI Jim): Sustituyeron formularios burocráticos de 20 páginas por interacciones conversacionales "
        "de 90 segundos para cotizar (AI Maya) y un sistema capaz de resolver y pagar siniestros peritados en tan solo 3 segundos (AI Jim) sin contacto humano.\n\n"
        "• Estrategia Multi-Ramo 'Land & Expand': Iniciaron con seguros para inquilinos (Renters) y mascotas (Pet) para capturar a la generación millennial "
        "y Gen Z, acompañando luego su ciclo vital hacia Hogar (Homeowners), Vida (Life) y Automóvil (Car)."
    )
    p_lem.runs[0].font.name = 'Arial'
    p_lem.runs[0].font.size = Pt(10)
    p_lem.paragraph_format.space_after = Pt(8)

    # Tuio Sub
    h2_2 = doc.add_heading(level=2)
    r_h2_2 = h2_2.add_run("2.2 Tuio (España / Europa) — Suscripción Mensual y Cero Permanencia")
    r_h2_2.font.name = 'Arial'
    r_h2_2.font.size = Pt(12)
    r_h2_2.font.bold = True
    r_h2_2.font.color.rgb = orange
    h2_2.paragraph_format.space_before = Pt(8)
    h2_2.paragraph_format.space_after = Pt(4)

    p_tui = doc.add_paragraph()
    p_tui.add_run(
        "• Modelo de Suscripción Flexible (Estilo Netflix): Rompieron la regla de los contratos anuales forzosos con cláusulas de renovación automática abusivas. "
        "El asegurado paga mensualmente y puede cancelar o pausar su cobertura desde el móvil en un clic sin penalizaciones.\n\n"
        "• Desintermediación Radical: Al eliminar intermediarios y redes tradicionales de corretaje físico, Tuio transfirió ese margen de ahorro "
        "directamente al cliente final, reduciendo la prima entre un 20% y 30% a la par de brindar una cobertura más robusta.\n\n"
        "• Transparencia y Lenguaje Llano: Erradicación absoluta de la jerga jurídica y letra pequeña en pólizas de hogar y mascotas en el mercado hispanohablante."
    )
    p_tui.runs[0].font.name = 'Arial'
    p_tui.runs[0].font.size = Pt(10)
    p_tui.paragraph_format.space_after = Pt(8)

    # ------------------ SECCIÓN 3 ------------------
    h3 = doc.add_heading(level=1)
    r_h3 = h3.add_run("3. Radiografía Crítica: Las Pólizas Actuales para Perros en Colombia")
    r_h3.font.name = 'Arial'
    r_h3.font.size = Pt(14)
    r_h3.font.bold = True
    r_h3.font.color.rgb = navy
    h3.paragraph_format.space_before = Pt(14)
    h3.paragraph_format.space_after = Pt(6)

    p3 = doc.add_paragraph()
    p3.add_run(
        "En el contexto colombiano actual, el mercado se encuentra dividido en dos modalidades deficientes que generan insatisfacción sistemática en los propietarios de mascotas:"
    )
    p3.runs[0].font.name = 'Arial'
    p3.runs[0].font.size = Pt(10)

    # Asistencias vs Tradicionales Sub
    p3_critica = doc.add_paragraph()
    p3_critica.add_run(
        "A. El Engaño de las Asistencias Comerciales (Bancos, Retail, Falabella, Éxito, Telcos):\n"
        "• Se comercializan mediante telemercadeo agresivo a tarifas aparentemente bajas ($15.000 a $25.000 COP/mes).\n"
        "• NO son pólizas de seguro de salud: son contratos de asistencia limitados a '2 consultas preventivas al año en red de bajo costo, 1 baño y 1 corte de uñas'.\n"
        "• Ante una emergencia médica real (torsión gástrica, politraumatismo vehicular, infección grave), el auxilio económico máximo oscila entre $200.000 y $300.000 COP, "
        "dejando desamparadas a las familias ante cuentas hospitalarias que superan fácilmente los $2.000.000 COP.\n\n"
        "B. La Hostilidad de las Aseguradoras Tradicionales (Sura, Seguros Bolívar, Mapfre, Allianz/SBS):\n"
        "• Tiempos de liquidación asfixiantes: Amparadas en el plazo de 30 días del artículo 1080 del Código de Comercio, se toman entre 15 y 30 días hábiles para reembolsar.\n"
        "• Imposición de redes cerradas: Obligan al usuario a llevar a su mascota a clínicas veterinarias en convenio que a menudo están congestionadas o distantes.\n"
        "• Burocracia precontractual: Exigen historias clínicas previas completas, exámenes de laboratorio de ingreso y formularios densos antes de cotizar.\n"
        "• El vacío de la Ley 1801 de 2016 (Razas de Manejo Especial): La ley obliga a contratar una póliza de RCE por 50 SMLMV ($87.545.250 COP en 2026) para 15 razas caninas. "
        "Las aseguradoras tradicionales discriminan a estas razas, cobran primas abusivas o exigen trámites presenciales para radicar el certificado en la Alcaldía."
    )
    p3_critica.runs[0].font.name = 'Arial'
    p3_critica.runs[0].font.size = Pt(9.5)
    p3_critica.paragraph_format.space_after = Pt(8)

    # ------------------ SECCIÓN 4 ------------------
    h4 = doc.add_heading(level=1)
    r_h4 = h4.add_run("4. Matriz Comparativa Exhaustiva de Mercado")
    r_h4.font.name = 'Arial'
    r_h4.font.size = Pt(14)
    r_h4.font.bold = True
    r_h4.font.color.rgb = navy
    h4.paragraph_format.space_before = Pt(14)
    h4.paragraph_format.space_after = Pt(6)

    tbl_comp = doc.add_table(rows=10, cols=5)
    tbl_comp.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl_comp.autofit = False
    widths_comp = [Inches(1.5), Inches(1.3), Inches(1.2), Inches(1.2), Inches(1.3)]
    format_table_headers_and_borders(tbl_comp, widths_comp, navy_hex="0A1C34", light_hex="F8FAFC", alt_hex="FFFFFF")

    comp_data = [
        ("Dimensión de Evaluación", "Aseguradora Tradicional (Sura / Bolívar)", "Asistencia Bancaria (Retail / Telco)", "Lemonade (EE.UU. / Europa)", "Manto 2.0 (Colombia)"),
        ("Tiempo de Cotización", "15 a 45 minutos (o días)", "Venta fría telefónica", "≤ 90 seg (AI Maya)", "≤ 60 seg con foto (Nuquí 🐾)"),
        ("Captura de Datos", "Formularios e historial previo", "Venta atada bancaria", "Chatbot móvil progresivo", "Foto de la carita; precio antes de pedir cédula"),
        ("Red Veterinaria", "Red preferente / convenio", "Clínica asignada rígida", "100% Libre elección", "100% Libre elección en toda Colombia"),
        ("Tiempo de Reembolso", "15 a 30 días hábiles", "No aplica (en especie)", "Minutos / 24-48 horas", "≤ 6 horas en STP (≤ $500k) / ≤ 48h auditoría"),
        ("Validación de Gastos", "Factura física manual", "Cupones de red", "Recibo digital y video", "Validación OCR DIAN con CUFE en segundos"),
        ("Dispersión de Fondos", "Cheque / abono diferido", "No aplica", "ACH interbancario", "Bre-B, Nequi, Daviplata, ACH inmediato"),
        ("Razas Ley 1801 (RCE)", "Rechazo o trámite manual", "No aplica", "N/A (Regulación foránea)", "Amparo legal 50 SMLMV ($87.545.250 COP) nativo"),
        ("Transparencia Lenguaje", "Hostil ('carencia', 'deducible')", "Engañoso ('todo incluido')", "Empático y cercano", "Micro-copia desmitificada ('tu aporte', 'cuota')"),
        ("Modelo de Suscripción", "Anual forzoso con renovación", "Cobro automático atado", "Mensual sin ataduras", "Mensual sin permanencia o anual (1 mes gratis)"),
    ]

    for r_idx, row in enumerate(comp_data):
        for c_idx, val in enumerate(row):
            tbl_comp.cell(r_idx, c_idx).paragraphs[0].text = val
            
    # Re-apply header styles for row 0
    format_table_headers_and_borders(tbl_comp, widths_comp, navy_hex="0A1C34", light_hex="F8FAFC", alt_hex="FFFFFF")
    doc.add_paragraph().paragraph_format.space_after = Pt(8)

    # ------------------ SECCIÓN 5 ------------------
    h5 = doc.add_heading(level=1)
    r_h5 = h5.add_run("5. Los 6 Pilares de Diferenciación de Manto 2.0")
    r_h5.font.name = 'Arial'
    r_h5.font.size = Pt(14)
    r_h5.font.bold = True
    r_h5.font.color.rgb = navy
    h5.paragraph_format.space_before = Pt(14)
    h5.paragraph_format.space_after = Pt(6)

    pillars = [
        ("1. Onboarding Visual con IA en < 60 Segundos (Nuquí 🐾)",
         "Eliminamos el tipeo engorroso. El usuario sube una fotografía casual de su mascota. La visión multimodal infiere especie, "
         "raza fenotípica y rango de edad. El usuario obtiene su cotización personalizada antes de entregar datos personales sensibles (cédula o teléfono)."),
        ("2. Liquidación Ultrarrápida con STP y Validación Fiscal DIAN (Sué ⚡)",
         "Aprovechamos la infraestructura de Factura Electrónica de Colombia. El motor de Sué ⚡ extrae y valida el CUFE ante la DIAN en segundos. "
         "Eventos de hasta $500.000 COP con bajo riesgo de fraude se liquidan de forma 100% automatizada (Straight-Through Processing) y se pagan vía Bre-B / Nequi / ACH en menos de 6 horas."),
        ("3. Libre Elección Médica Absoluta en Toda Colombia",
         "El amor y la salud de la mascota no se negocian con redes cerradas impuestas. El asegurado puede acudir a su médico veterinario de cabecera "
         "o a cualquier clínica constituida legalmente en el territorio nacional; Manto reembolsa el gasto elegible sin penalizaciones."),
        ("4. Cumplimiento Inclusivo y Nativo de la Ley 1801 de 2016",
         "A diferencia de las aseguradoras tradicionales que rechazan caninos de manejo especial, Manto integra obligatoriamente el amparo de 50 SMLMV "
         "($87.545.250 COP en 2026) y genera de inmediato el carnet digital y certificado con firma electrónica (Ley 527 de 1999) para radicar en la Alcaldía."),
        ("5. Desmitificación Radical del Lenguaje (Cero Jerga Hostil)",
         "Sustituimos el vocabulario legalista tradicional por conceptos empáticos: 'Tu aporte por evento' (deducible), 'Porcentaje compartido' (copago), "
         "'Cuota mensual' (prima), 'Días para activación de cobertura' (carencia) y 'Reembolso veterinario' (siniestro)."),
        ("6. Determinismo Actuarial Ético (Cero Alucinaciones con el Dinero)",
         "La IA nunca fija precios ni niega coberturas. El cálculo reside en un motor actuarial del lado servidor (PricingService) respaldado por tipos enteros "
         "ColombianPeso (bigint) para erradicar errores de coma flotante. Cumplimiento pleno de Habeas Data (Ley 1581 de 2012) con soporte de supresión de datos.")
    ]

    for p_title, p_desc in pillars:
        p_pil = doc.add_paragraph()
        r1 = p_pil.add_run(p_title + "\n")
        r1.font.name = 'Arial'
        r1.font.size = Pt(11)
        r1.font.bold = True
        r1.font.color.rgb = orange
        
        r2 = p_pil.add_run(p_desc)
        r2.font.name = 'Arial'
        r2.font.size = Pt(9.5)
        p_pil.paragraph_format.space_after = Pt(6)

    # ------------------ SECCIÓN 6 ------------------
    h6 = doc.add_heading(level=1)
    r_h6 = h6.add_run("6. Estructura y Manual de Tarificación de Precios (Pricing Actuarial 2026)")
    r_h6.font.name = 'Arial'
    r_h6.font.size = Pt(14)
    r_h6.font.bold = True
    r_h6.font.color.rgb = navy
    h6.paragraph_format.space_before = Pt(14)
    h6.paragraph_format.space_after = Pt(6)

    p6 = doc.add_paragraph()
    p6.add_run(
        "Manto 2.0 utiliza un paradigma de Tarifa Base Dinámica a la Medida (Tailored Baseline). El sistema no impone paquetes inflexibles; "
        "calcula una tarifa base con coberturas mínimas esenciales según el perfil biomédico y territorial de la mascota, y permite ampliar mediante Add-ons modulares.\n\n"
        "Fórmula Actuarial Determinista:\n"
        "TarifaBaseNeta = TasaPura × F(especie) × F(raza) × F(tamaño) × F(edad) × F(ubicación) × F(sexo) × (1 - D(multimascota)) × F(deducible)\n"
        "PrimaMensualFinalCOP = round(TarifaBaseNeta) + ∑ AddonsMensuales\n"
        "PrimaAnualFinalCOP = round(PrimaMensualFinalCOP × 11)   (Beneficio de 1 mes gratis por pago anticipado)"
    )
    p6.runs[0].font.name = 'Arial'
    p6.runs[0].font.size = Pt(9.5)
    p6.paragraph_format.space_after = Pt(8)

    # Factores Table
    tbl_fac = doc.add_table(rows=8, cols=3)
    tbl_fac.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl_fac.autofit = False
    widths_fac = [Inches(2.0), Inches(2.3), Inches(2.2)]
    format_table_headers_and_borders(tbl_fac, widths_fac, navy_hex="0A1C34", light_hex="F8FAFC", alt_hex="FFFFFF")

    fac_data = [
        ("Variable Actuarial", "Rango / Categoría", "Factor Multiplicador Oficial (2026)"),
        ("Tasa Pura Base", "Tarifa de arranque estándar", "$30.000 COP / mes"),
        ("Especie", "Canino (1.00) | Felino (0.92)", "Felinos 8% más económicos por menor exposición traumatológica"),
        ("Tamaño / Peso", "Toy (0.92) | Small (0.96) | Medium (1.00) | Large (1.08) | Giant (1.18)", "Calibrado según dosimetría anestésica y costo quirúrgico"),
        ("Ubicación Geográfica", "Bogotá (1.05) | Medellín/Cali (1.00) | Otras Ciudades (0.95)", "Refleja aranceles veterinarios promedio por región"),
        ("Sexo", "Macho (1.03) | Hembra (1.00)", "Recargo conservador del 3% en machos por siniestralidad de trauma"),
        ("Descuento Multimascota", "≥ 2 mascotas bajo el mismo titular", "5% de descuento sobre la tarifa base de cada mascota"),
        ("Ley 1801 de 2016 (50 SMLMV)", "Decreto 0159/2026: SMLMV = $1.750.905 COP", "Amparo RCE obligatorio e inmutable: $87.545.250 COP"),
    ]

    for r_idx, row in enumerate(fac_data):
        for c_idx, val in enumerate(row):
            tbl_fac.cell(r_idx, c_idx).paragraphs[0].text = val
    format_table_headers_and_borders(tbl_fac, widths_fac, navy_hex="0A1C34", light_hex="F8FAFC", alt_hex="FFFFFF")
    doc.add_paragraph().paragraph_format.space_after = Pt(8)

    # Coberturas Plan Base
    h6_1 = doc.add_heading(level=2)
    r_h6_1 = h6_1.add_run("Coberturas Mínimas del Plan Base Universal ($4.750.000 COP Cobertura Total)")
    r_h6_1.font.name = 'Arial'
    r_h6_1.font.size = Pt(11)
    r_h6_1.font.bold = True
    r_h6_1.font.color.rgb = orange
    h6_1.paragraph_format.space_before = Pt(6)
    h6_1.paragraph_format.space_after = Pt(4)

    p_base = doc.add_paragraph()
    p_base.add_run(
        "1. Urgencias & Hospitalización por Accidente: Hasta $3.500.000 COP/año (Carencia: 0 días | Cobertura inmediata).\n"
        "2. Consultas de Urgencia Presencial: 3 eventos al año por hasta $450.000 COP ($150.000 COP por consulta | Carencia: 2 días).\n"
        "3. Exámenes Diagnósticos de Choque: Hasta $800.000 COP/año (Rayos X, ecografía FAST, hemoleucograma | Carencia: 0 días).\n"
        "4. Deducible / Aporte por Evento: Opciones seleccionables del 10%, 15% o 20% (mínimo $40.000 o $50.000 COP)."
    )
    p_base.runs[0].font.name = 'Arial'
    p_base.runs[0].font.size = Pt(9.5)
    p_base.paragraph_format.space_after = Pt(8)

    # Catálogo Add-ons
    h6_2 = doc.add_heading(level=2)
    r_h6_2 = h6_2.add_run("Catálogo de Expansión Modular (Add-ons Opcionales)")
    r_h6_2.font.name = 'Arial'
    r_h6_2.font.size = Pt(11)
    r_h6_2.font.bold = True
    r_h6_2.font.color.rgb = orange
    h6_2.paragraph_format.space_before = Pt(6)
    h6_2.paragraph_format.space_after = Pt(4)

    p_addons = doc.add_paragraph()
    p_addons.add_run(
        "• Asistencia Exequial y Cremación Individual/Colectiva: +$9.900 COP / mes.\n"
        "• Telemedicina Veterinaria Ilimitada 24/7: +$6.900 COP / mes.\n"
        "• Ampliación a Enfermedades Comunes e Infecciosas: +$24.900 COP / mes.\n"
        "• Medicamentos Recetados Ambulatorios: +$12.900 COP / mes.\n"
        "• Guardería Canina / Felina por Hospitalización del Tomador: +$4.900 COP / mes."
    )
    p_addons.runs[0].font.name = 'Arial'
    p_addons.runs[0].font.size = Pt(9.5)
    p_addons.paragraph_format.space_after = Pt(10)

    # ------------------ SECCIÓN 7 ------------------
    h7 = doc.add_heading(level=1)
    r_h7 = h7.add_run("7. Trazabilidad y Archivos del Repositorio")
    r_h7.font.name = 'Arial'
    r_h7.font.size = Pt(14)
    r_h7.font.bold = True
    r_h7.font.color.rgb = navy
    h7.paragraph_format.space_before = Pt(14)
    h7.paragraph_format.space_after = Pt(6)

    p7 = doc.add_paragraph()
    p7.add_run(
        "Para auditoría técnica, las fuentes canónicas en el repositorio son:\n"
        "• Documento Maestro Actuarial V3: docs/actuarial/VALIDACION_ACTUARIAL_MATRIZ_V3.md\n"
        "• Especificación de Pricing Engine: docs/agentes/pricing-engine/PRICING_ENGINE.md\n"
        "• Constantes y Factores de Producción: backend/src/modules/pricing/pricing.constants.ts\n"
        "• Servicio Determinista NestJS: backend/src/modules/pricing/pricing.service.ts\n"
        "• Catálogo Oficial de Razas: docs/CATALOGO_RAZAS_ASEGURABLES.md"
    )
    p7.runs[0].font.name = 'Arial'
    p7.runs[0].font.size = Pt(9.5)
    p7.paragraph_format.space_after = Pt(12)

    # Footer
    p_foot = doc.add_paragraph()
    p_foot.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r_foot = p_foot.add_run("© 2026 Manto Seguros Digitales S.A.S. • Todos los derechos reservados • Confidencial")
    r_foot.font.name = 'Arial'
    r_foot.font.size = Pt(8)
    r_foot.font.italic = True
    r_foot.font.color.rgb = gray_muted

    target_path = r"e:\Manto 2.0\Información relevante\02_MANTO_DIFERENCIACION_ESTRATEGICA_BENCHMARK_Y_PRICING.docx"
    doc.save(target_path)
    print(f"Documento generado exitosamente en: {target_path}")

if __name__ == "__main__":
    generate_document()
