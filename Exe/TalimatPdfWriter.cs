using PdfSharpCore.Drawing;
using PdfSharpCore.Pdf;

namespace GiyimYardimi;

/// <summary>
/// Harcama Talimatı'nı resmî Ek-1 biçiminde, dikey A4 olarak doğrudan PDF'e çizer.
/// </summary>
internal static class TalimatPdfWriter
{
    private const double PageWidthMm = 210;
    private const double PageHeightMm = 297;
    private const double MarginMm = 22;

    public static bool TryCreate(string outputPath, string batchId, string dataFile, out string? error)
    {
        error = null;
        try
        {
            var model = BatchDocumentModel.Load(dataFile, batchId);
            if (model is null) { error = "Ödeme kaydı bulunamadı."; return false; }
            PdfDrawing.EnsureFonts();
            Render(outputPath, model);
            return true;
        }
        catch (Exception ex)
        {
            error = ex.Message;
            return false;
        }
    }

    private static void Render(string path, BatchDocumentModel m)
    {
        using var doc = new PdfDocument();
        var page = doc.AddPage();
        page.Width = XUnit.FromMillimeter(PageWidthMm);
        page.Height = XUnit.FromMillimeter(PageHeightMm);
        using var gfx = XGraphics.FromPdfPage(page);

        var black = XBrushes.Black;
        var titleFont = new XFont("Arial", 12, XFontStyle.Bold);
        var headFont = new XFont("Arial", 9.5, XFontStyle.Bold);
        var bodyFont = new XFont("Arial", 9, XFontStyle.Regular);
        var smallFont = new XFont("Arial", 8, XFontStyle.Regular);
        var bandFont = new XFont("Arial", 6.5, XFontStyle.Bold);
        var lineHeight = PdfDrawing.Mm(4.3);

        double left = PdfDrawing.Mm(MarginMm);
        double width = PdfDrawing.Mm(PageWidthMm - MarginMm * 2);
        double right = left + width;

        // --- Başlık ---
        double y = PdfDrawing.Mm(14);
        gfx.DrawString("Ek-1", smallFont, black, new XRect(left, y, width, PdfDrawing.Mm(5)), XStringFormats.TopRight);
        gfx.DrawString("HARCAMA TALİMATI", titleFont, black, new XRect(left, PdfDrawing.Mm(20), width, PdfDrawing.Mm(8)), XStringFormats.TopCenter);

        // --- Sayı / Tarih ---
        y = PdfDrawing.Mm(31);
        gfx.DrawString($"Sayı: {m.Number}", bodyFont, black, new XRect(left, y, width / 2, PdfDrawing.Mm(5)), XStringFormats.TopLeft);
        gfx.DrawString($"Tarih: {m.DateText}", bodyFont, black, new XRect(left, y, width, PdfDrawing.Mm(5)), XStringFormats.TopRight);

        // --- Birim ---
        y = PdfDrawing.Mm(39);
        var unitLabel = "Harcama talebinde bulunan birim: ";
        var unitLabelWidth = gfx.MeasureString(unitLabel, headFont).Width;
        gfx.DrawString(unitLabel, headFont, black, new XRect(left, y, width, PdfDrawing.Mm(5)), XStringFormats.TopLeft);
        gfx.DrawString(m.UnitName, bodyFont, black, new XRect(left + unitLabelWidth, y, width - unitLabelWidth, PdfDrawing.Mm(5)), XStringFormats.TopLeft);

        // --- Makam ---
        y = PdfDrawing.Mm(47);
        var makam = string.IsNullOrWhiteSpace(m.UnitName)
            ? "…………………… MÜDÜRLÜĞÜ MAKAMINA"
            : m.UnitName.ToUpper(PdfDrawing.Tr) + " MAKAMINA";
        gfx.DrawString(makam, headFont, black, new XRect(left, y, width, PdfDrawing.Mm(6)), XStringFormats.TopCenter);

        // --- Tablo ---
        var rows = new (string Label, string Value)[]
        {
            ("Gerekçesi ve hukuki dayanağı", m.Basis),
            ("Konusu / nev’i / niteliği", m.Subject),
            ("Miktarı", m.Quantity),
            ("Gerçekleştirme süresi", m.Period),
            ("Gerçekleştirme usulü", m.Method),
            ("Tutarı veya belirlenmişse yaklaşık bedeli", PdfDrawing.MoneyTl(m.Amount)),
            ("Kullanılabilir ödenek tutarı", PdfDrawing.MoneyTl(m.Appropriation)),
            ("Ödeneğin bütçe tertibi", m.Budget),
            ("Gerçekleştirme görevlileri", m.Officers),
            ("Harcama Yetkilisi", m.Authority.Name)
        };

        double bandWidth = PdfDrawing.Mm(7);
        double labelWidth = PdfDrawing.Mm(58);
        double valueWidth = width - bandWidth - labelWidth;
        double tableTop = PdfDrawing.Mm(57);

        // Satır yükseklikleri: etiket ve değerin sarılan satır sayısına göre
        var heights = new double[rows.Length];
        for (var i = 0; i < rows.Length; i++)
        {
            var labelLines = PdfDrawing.LineCount(gfx, rows[i].Label, smallFont, labelWidth - PdfDrawing.Mm(4));
            var valueLines = PdfDrawing.LineCount(gfx, rows[i].Value, bodyFont, valueWidth - PdfDrawing.Mm(4));
            var lines = Math.Max(1, Math.Max(labelLines, valueLines));
            heights[i] = Math.Max(PdfDrawing.Mm(9), lines * lineHeight + PdfDrawing.Mm(3.4));
        }
        var tableHeight = heights.Sum();

        gfx.DrawRectangle(XPens.Black, new XRect(left, tableTop, width, tableHeight));

        // Dikey şerit
        gfx.DrawLine(XPens.Black, left + bandWidth, tableTop, left + bandWidth, tableTop + tableHeight);
        gfx.DrawLine(XPens.Black, left + bandWidth + labelWidth, tableTop, left + bandWidth + labelWidth, tableTop + tableHeight);
        var bandText = "YAPILACAK HARCAMANIN";
        var letterStep = PdfDrawing.Mm(3.6);
        var bandTextHeight = bandText.Length * letterStep;
        var bandY = tableTop + (tableHeight - bandTextHeight) / 2;
        foreach (var ch in bandText)
        {
            if (ch != ' ')
                gfx.DrawString(ch.ToString(), bandFont, black,
                    new XRect(left, bandY, bandWidth, letterStep), XStringFormats.TopCenter);
            bandY += letterStep;
        }

        var rowY = tableTop;
        for (var i = 0; i < rows.Length; i++)
        {
            if (i > 0)
                gfx.DrawLine(XPens.Black, left, rowY, right, rowY);

            var labelX = left + bandWidth + PdfDrawing.Mm(2);
            PdfDrawing.DrawWrapped(gfx, rows[i].Label, smallFont, black, labelX, rowY + PdfDrawing.Mm(2.2), labelWidth - PdfDrawing.Mm(4), lineHeight);

            var valueX = left + bandWidth + labelWidth + PdfDrawing.Mm(2);
            PdfDrawing.DrawWrapped(gfx, rows[i].Value, bodyFont, black, valueX, rowY + PdfDrawing.Mm(2.2), valueWidth - PdfDrawing.Mm(4), lineHeight);

            rowY += heights[i];
        }

        // --- Açıklamalar ---
        y = tableTop + tableHeight + PdfDrawing.Mm(7);
        gfx.DrawString("AÇIKLAMALAR:", headFont, black, new XRect(left, y, width, PdfDrawing.Mm(5)), XStringFormats.TopLeft);
        y += PdfDrawing.Mm(5.5);
        var explanationLines = PdfDrawing.LineCount(gfx, m.Explanation, bodyFont, width - PdfDrawing.Mm(6));
        var explanationHeight = Math.Max(PdfDrawing.Mm(35), explanationLines * lineHeight + PdfDrawing.Mm(5));
        gfx.DrawRectangle(XPens.Black, new XRect(left, y, width, explanationHeight));
        PdfDrawing.DrawWrapped(gfx, m.Explanation, bodyFont, black, left + PdfDrawing.Mm(3), y + PdfDrawing.Mm(2.6), width - PdfDrawing.Mm(6), lineHeight);

        // --- Kapanış cümlesi ---
        y += explanationHeight + PdfDrawing.Mm(7);
        var closing = $"Yukarıda belirtilen tutarın {PdfDrawing.MoneyTl(m.Amount)} ödenmesi hususu olurlarınıza arzolunur.";
        var closingLines = PdfDrawing.LineCount(gfx, closing, bodyFont, width * 0.62);
        PdfDrawing.DrawWrapped(gfx, closing, bodyFont, black, left, y, width * 0.62, lineHeight);

        // --- İmzalar ---
        // Resmî formdaki konum esas alınır; açıklama uzunsa imzalar aşağı kaydırılır.
        var signTop = Math.Min(PdfDrawing.Mm(242),
            Math.Max(PdfDrawing.Mm(228), y + closingLines * lineHeight + PdfDrawing.Mm(6)));
        var columnWidth = width / 2;

        void DrawSignature(double x, double w, string header, BatchDocumentModel.Signer signer, bool showOlur)
        {
            var sy = signTop;
            if (showOlur)
            {
                // "O L U R" her iki sütunun başlık hizasının üstünde yer alır.
                gfx.DrawString("O L U R", headFont, black,
                    new XRect(x, sy - PdfDrawing.Mm(7.5), w, PdfDrawing.Mm(5)), XStringFormats.TopCenter);
            }
            gfx.DrawString(header, headFont, black, new XRect(x, sy, w, PdfDrawing.Mm(5)), XStringFormats.TopCenter);
            sy += PdfDrawing.Mm(9);
            gfx.DrawString("İmzası : ................................", smallFont, black, new XRect(x, sy, w, PdfDrawing.Mm(4.5)), XStringFormats.TopCenter);
            sy += PdfDrawing.Mm(5.5);
            gfx.DrawString("Adı Soyadı : " + signer.Name, bodyFont, black, new XRect(x, sy, w, PdfDrawing.Mm(4.5)), XStringFormats.TopCenter);
            sy += PdfDrawing.Mm(5);
            gfx.DrawString("Unvanı : " + signer.Title, bodyFont, black, new XRect(x, sy, w, PdfDrawing.Mm(4.5)), XStringFormats.TopCenter);
        }

        DrawSignature(left, columnWidth, "Teklif Eden Yetkilinin", m.Proposed, false);
        DrawSignature(left + columnWidth, columnWidth, "Harcama Yetkilisi", m.Authority, true);

        doc.Save(path);
    }
}
