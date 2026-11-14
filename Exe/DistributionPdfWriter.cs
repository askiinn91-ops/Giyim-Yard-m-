using PdfSharpCore.Drawing;
using PdfSharpCore.Pdf;

namespace GiyimYardimi;

/// <summary>
/// Giyim Yardımı Listesi'ni resmî biçimde, yatay A4 olarak doğrudan PDF'e çizer.
/// Sütunlar: Sıra · Adı Soyadı · Unvanı · Hizmet Sınıfı · Giyim Eşyası · Tür · Adet · Brüt · Damga · Net
/// </summary>
internal static class DistributionPdfWriter
{
    private const double PageWidthMm = 297;
    private const double PageHeightMm = 210;
    private const double MarginMm = 12;

    // Sütun genişlikleri (mm) — toplam 273
    private static readonly double[] Columns = { 10, 42, 36, 40, 57, 16, 12, 20, 20, 20 };
    private static readonly string[] Headers =
    {
        "Sıra", "Adı Soyadı", "Unvanı", "Hizmet Sınıfı", "Giyim Eşyası", "Tür", "Adet",
        "Brüt Tutar (TL)", "Damga Vergisi (TL)", "Net Tutar (TL)"
    };

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
        var black = XBrushes.Black;
        var titleFont = new XFont("Arial", 12, XFontStyle.Bold);
        var subTitleFont = new XFont("Arial", 10, XFontStyle.Bold);
        var metaFont = new XFont("Arial", 8.5, XFontStyle.Regular);
        var headFont = new XFont("Arial", 8, XFontStyle.Bold);
        var bodyFont = new XFont("Arial", 8.5, XFontStyle.Regular);
        var totalFont = new XFont("Arial", 9, XFontStyle.Bold);
        var signFont = new XFont("Arial", 8, XFontStyle.Regular);

        double left = PdfDrawing.Mm(MarginMm);
        double width = PdfDrawing.Mm(PageWidthMm - MarginMm * 2);
        double right = left + width;
        double tableWidth = Columns.Sum(PdfDrawing.Mm);

        double headerHeight = PdfDrawing.Mm(9);
        double rowHeight = PdfDrawing.Mm(5.6);
        double tableTop = PdfDrawing.Mm(46);
        double tableBottomFull = PdfDrawing.Mm(PageHeightMm - MarginMm - 1);
        double tableBottomLast = PdfDrawing.Mm(PageHeightMm - MarginMm - 39);
        double totalRowHeight = PdfDrawing.Mm(7.5);

        // Sayfa başına satır dağılımı: sayfalar doldurulur, son sayfada imza için yer bırakılır.
        var firstRowY = tableTop + headerHeight;
        var perFull = Math.Max(1, (int)Math.Floor((tableBottomFull - firstRowY) / rowHeight));
        var perLast = Math.Max(1, (int)Math.Floor((tableBottomLast - firstRowY) / rowHeight));

        var rowCounts = PlanPages(m.Rows.Count, perFull, perLast);

        var pageIndex = 0;
        var rowIndex = 0;
        var totalGross = m.GrossTotal;
        var totalStamp = m.StampTotal;
        var totalNet = m.NetTotal;

        while (rowIndex < m.Rows.Count || pageIndex == 0)
        {
            var page = doc.AddPage();
            page.Width = XUnit.FromMillimeter(PageWidthMm);
            page.Height = XUnit.FromMillimeter(PageHeightMm);
            using var gfx = XGraphics.FromPdfPage(page);
            pageIndex++;
            var pageStartRow = rowIndex;
            var pageRowLimit = Math.Min(m.Rows.Count, pageStartRow + rowCounts[pageIndex - 1]);

            // --- Başlık bloğu ---
            double y = PdfDrawing.Mm(11);
            gfx.DrawString("T.C.", subTitleFont, black, new XRect(left, y, width, PdfDrawing.Mm(5)), XStringFormats.TopCenter);
            y += PdfDrawing.Mm(5.5);
            if (!string.IsNullOrWhiteSpace(m.KaymakamlikName))
            {
                gfx.DrawString(m.KaymakamlikName.ToUpper(PdfDrawing.Tr), subTitleFont, black,
                    new XRect(left, y, width, PdfDrawing.Mm(5)), XStringFormats.TopCenter);
                y += PdfDrawing.Mm(5.5);
            }
            gfx.DrawString(m.UnitName.ToUpper(PdfDrawing.Tr), subTitleFont, black,
                new XRect(left, y, width, PdfDrawing.Mm(5)), XStringFormats.TopCenter);
            y += PdfDrawing.Mm(6.5);
            gfx.DrawString("GİYİM YARDIMI LİSTESİ" + (pageIndex > 1 ? " (devam)" : ""), titleFont, black,
                new XRect(left, y, width, PdfDrawing.Mm(7)), XStringFormats.TopCenter);

            // --- Künye ---
            y = PdfDrawing.Mm(38);
            var meta = $"Kurum: {m.InstitutionName}     Yıl: {m.Year}     Tarih: {m.DateText}     Personel: {m.PersonCount}";
            gfx.DrawString(meta, metaFont, black, new XRect(left, y, width, PdfDrawing.Mm(5)), XStringFormats.TopLeft);

            // --- Tablo başlığı ---
            var top = tableTop;
            gfx.DrawRectangle(XPens.Black, new XRect(left, top, tableWidth, headerHeight));
            double x = left;
            for (var c = 0; c < Columns.Length; c++)
            {
                var cw = PdfDrawing.Mm(Columns[c]);
                if (c > 0) gfx.DrawLine(XPens.Black, x, top, x, top + headerHeight);
                var headerLines = PdfDrawing.Wrap(gfx, Headers[c], headFont, cw - PdfDrawing.Mm(2));
                var hy = top + (headerHeight - headerLines.Count * PdfDrawing.Mm(3.4)) / 2;
                foreach (var line in headerLines)
                {
                    gfx.DrawString(line, headFont, black, new XRect(x, hy, cw, PdfDrawing.Mm(3.6)), XStringFormats.TopCenter);
                    hy += PdfDrawing.Mm(3.4);
                }
                x += cw;
            }

            // --- Satırlar ---
            y = top + headerHeight;
            while (rowIndex < pageRowLimit)
            {
                var row = m.Rows[rowIndex];
                rowIndex++;

                gfx.DrawRectangle(XPens.Black, new XRect(left, y, tableWidth, rowHeight));
                x = left;
                var values = new[]
                {
                    rowIndex.ToString(),
                    row.Name,
                    row.Title,
                    row.ServiceClass,
                    row.Item,
                    row.Mode == "Ayni" ? "Ayni" : "Nakdi",
                    row.Quantity.ToString(),
                    PdfDrawing.Money(row.Gross),
                    PdfDrawing.Money(row.Stamp),
                    PdfDrawing.Money(row.Net)
                };

                for (var c = 0; c < Columns.Length; c++)
                {
                    var cw = PdfDrawing.Mm(Columns[c]);
                    if (c > 0) gfx.DrawLine(XPens.Black, x, y, x, y + rowHeight);
                    var align = c >= 7 ? XStringFormats.TopRight : (c is 0 or 6 ? XStringFormats.TopCenter : XStringFormats.TopLeft);
                    var padding = c >= 7 ? PdfDrawing.Mm(1.5) : PdfDrawing.Mm(1);
                    var text = FitText(gfx, values[c], bodyFont, cw - PdfDrawing.Mm(2));
                    gfx.DrawString(text, bodyFont, black,
                        new XRect(x + padding, y + PdfDrawing.Mm(1.9), cw - PdfDrawing.Mm(2), PdfDrawing.Mm(4)), align);
                    x += cw;
                }
                y += rowHeight;
            }

            var isLastPage = rowIndex >= m.Rows.Count;

            // --- Toplam satırı ---
            if (isLastPage)
            {
                gfx.DrawRectangle(XPens.Black, new XRect(left, y, tableWidth, totalRowHeight));
                x = left;
                for (var c = 0; c < Columns.Length; c++)
                {
                    var cw = PdfDrawing.Mm(Columns[c]);
                    if (c > 0) gfx.DrawLine(XPens.Black, x, y, x, y + totalRowHeight);
                    x += cw;
                }
                var totalLabelWidth = Columns.Take(7).Sum(PdfDrawing.Mm);
                gfx.DrawString("TOPLAM", totalFont, black,
                    new XRect(left + PdfDrawing.Mm(2), y + PdfDrawing.Mm(2.2), totalLabelWidth - PdfDrawing.Mm(4), PdfDrawing.Mm(4.5)),
                    XStringFormats.TopRight);

                var moneyX = left + totalLabelWidth;
                var moneyValues = new[] { PdfDrawing.Money(totalGross), PdfDrawing.Money(totalStamp), PdfDrawing.Money(totalNet) };
                for (var c = 7; c < Columns.Length; c++)
                {
                    var cw = PdfDrawing.Mm(Columns[c]);
                    gfx.DrawString(moneyValues[c - 7], totalFont, black,
                        new XRect(moneyX + PdfDrawing.Mm(1.5), y + PdfDrawing.Mm(2.2), cw - PdfDrawing.Mm(2), PdfDrawing.Mm(4.5)),
                        XStringFormats.TopRight);
                    moneyX += cw;
                }
                y += totalRowHeight;

                // --- İmzalar ---
                var signTop = PdfDrawing.Mm(PageHeightMm - MarginMm - 26);
                var columnWidth = tableWidth / 3.0;
                var labels = new[] { "Düzenleyen", "Kontrol Eden", "Onaylayan" };
                var signers = new[] { m.Editor, m.Proposed, m.Authority };
                for (var i = 0; i < 3; i++)
                {
                    var sx = left + i * columnWidth;
                    gfx.DrawString(labels[i], totalFont, black, new XRect(sx, signTop, columnWidth, PdfDrawing.Mm(5)), XStringFormats.TopCenter);
                    gfx.DrawString("İmzası : ........................", signFont, black, new XRect(sx, signTop + PdfDrawing.Mm(6), columnWidth, PdfDrawing.Mm(4)), XStringFormats.TopCenter);
                    gfx.DrawString(signers[i].Name, bodyFont, black, new XRect(sx, signTop + PdfDrawing.Mm(12), columnWidth, PdfDrawing.Mm(4)), XStringFormats.TopCenter);
                    gfx.DrawString(signers[i].Title, signFont, black, new XRect(sx, signTop + PdfDrawing.Mm(16.5), columnWidth, PdfDrawing.Mm(4)), XStringFormats.TopCenter);
                }
            }

            if (isLastPage) break;
        }

        doc.Save(path);
    }

    /// <summary>
    /// Sayfa başına satır sayılarını planlar: önce sayfalar tam doldurulur, son sayfa
    /// toplam ve imza satırlarına yer bırakacak biçimde sınırlanır. Son sayfa çok az
    /// satırla kalmışsa son iki sayfa dengelenir.
    /// </summary>
    private static int[] PlanPages(int rowCount, int perFull, int perLast)
    {
        if (rowCount <= 0) return [0];

        var pageCount = (int)Math.Ceiling(rowCount / (double)perFull);
        while (rowCount - perFull * (pageCount - 1) > perLast) pageCount++;

        var counts = new int[pageCount];
        var remaining = rowCount;
        for (var i = 0; i < pageCount; i++)
        {
            counts[i] = Math.Min(perFull, remaining);
            remaining -= counts[i];
        }

        // Son sayfa neredeyse boş kalıyorsa son iki sayfayı dengeli böl.
        if (pageCount >= 2 && counts[^1] < perFull / 2)
        {
            var total = counts[^2] + counts[^1];
            var last = Math.Min(perLast, total / 2);
            counts[^1] = last;
            counts[^2] = total - last;
        }

        return counts;
    }

    /// <summary>Sığmayan uzun metni kısaltır (sütun genişliği sabit).</summary>
    private static string FitText(XGraphics gfx, string text, XFont font, double maxWidth)
    {
        if (string.IsNullOrEmpty(text)) return "";
        if (gfx.MeasureString(text, font).Width <= maxWidth) return text;
        var trimmed = text;
        while (trimmed.Length > 1 && gfx.MeasureString(trimmed + "…", font).Width > maxWidth)
            trimmed = trimmed[..^1];
        return trimmed.TrimEnd() + "…";
    }
}
