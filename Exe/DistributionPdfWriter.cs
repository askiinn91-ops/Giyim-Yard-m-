using System.Globalization;
using System.Text.Json;
using PdfSharpCore.Drawing;
using PdfSharpCore.Fonts;
using PdfSharpCore.Pdf;

namespace GiyimYardimi;

/// <summary>Dağıtım listesini yatay A4 olarak doğrudan PDF'e çizer.</summary>
internal static class DistributionPdfWriter
{
    private static bool _fontReady;

    public static void EnsureFonts()
    {
        if (_fontReady) return;
        GlobalFontSettings.FontResolver = new WindowsFontResolver();
        _fontReady = true;
    }

    public static bool TryCreate(string outputPath, string batchId, string dataFile, out string? error)
    {
        error = null;
        try
        {
            var model = DistributionModel.Load(dataFile, batchId);
            if (model is null) { error = "Ödeme kaydı bulunamadı."; return false; }
            EnsureFonts();
            Render(outputPath, model);
            return true;
        }
        catch (Exception ex)
        {
            error = ex.Message;
            return false;
        }
    }

    private static void Render(string path, DistributionModel m)
    {
        using var doc = new PdfDocument();
        var page = doc.AddPage();
        page.Width = XUnit.FromMillimeter(297);
        page.Height = XUnit.FromMillimeter(210);
        using var gfx = XGraphics.FromPdfPage(page);

        var titleFont = new XFont("Arial", 11, XFontStyle.Bold);
        var headFont = new XFont("Arial", 8, XFontStyle.Bold);
        var bodyFont = new XFont("Arial", 8, XFontStyle.Regular);
        var totalFont = new XFont("Arial", 9, XFontStyle.Bold);
        var black = XBrushes.Black;

        double margin = 12;
        double width = 297 - margin * 2;
        double y = margin;

        gfx.DrawString("Tarih: " + m.DateText, bodyFont, black, new XRect(margin, y, width, 6), XStringFormats.TopRight);
        y += 9;
        gfx.DrawString(m.Title, titleFont, black, new XRect(margin, y, width, 8), XStringFormats.TopLeft);
        y += 10;

        // Sütun genişlikleri (mm)
        double[] cols = { 12, 46, 38, 30, 78, 33, 36 };
        double tableWidth = cols.Sum();
        double scale = width / tableWidth;
        for (var i = 0; i < cols.Length; i++) cols[i] *= scale;

        string[] headers = { "Sıra No", "Adı Soyadı", "Unvanı", "T.C.", "Yardım Adı", "Tutarı", "Adedi" };
        double rowH = 6.4;
        double headerH = 7.5;

        // Başlık satırı
        gfx.DrawRectangle(XPens.Black, new XRect(margin, y, cols.Sum(), headerH));
        double x = margin;
        for (var i = 0; i < headers.Length; i++)
        {
            if (i > 0) gfx.DrawLine(XPens.Black, x, y, x, y + headerH);
            gfx.DrawString(headers[i], headFont, black, new XRect(x + 1, y + 1.8, cols[i] - 2, headerH), XStringFormats.TopCenter);
            x += cols[i];
        }
        gfx.DrawLine(XPens.Black, margin, y + headerH, margin + cols.Sum(), y + headerH);
        y += headerH;

        var pageBottom = 210 - margin - 30; // imzalar için alt boşluk
        var index = 0;
        foreach (var person in m.People)
        {
            index++;
            var lines = Math.Max(1, person.Items.Count);
            var blockH = rowH * lines;
            if (y + Math.Min(blockH, rowH * 2) > pageBottom) break;

            var top = y;
            x = margin;
            // Birleşik hücreler (kişi bilgileri)
            double[] mergedWidths = { cols[0], cols[1], cols[2], cols[3] };
            string[] mergedText =
            {
                index.ToString(CultureInfo.InvariantCulture),
                person.Name,
                person.Title,
                person.NationalId
            };
            for (var c = 0; c < 4; c++)
            {
                gfx.DrawRectangle(XPens.Black, new XRect(x, top, mergedWidths[c], blockH));
                var align = c == 0 ? XStringFormats.TopCenter : XStringFormats.TopLeft;
                gfx.DrawString(mergedText[c], bodyFont, black, new XRect(x + 1, top + (blockH - 3.2) / 2, mergedWidths[c] - 2, 4), align);
                x += mergedWidths[c];
            }
            // Yardım satırları
            double itemX = x;
            for (var r = 0; r < lines; r++)
            {
                var item = person.Items[r];
                var ry = top + r * rowH;
                var cx = itemX;
                var values = new[] { item.Name, item.AmountText, item.QuantityText };
                for (var c = 4; c < 7; c++)
                {
                    gfx.DrawRectangle(XPens.Black, new XRect(cx, ry, cols[c], rowH));
                    var align = c == 4 ? XStringFormats.TopLeft : XStringFormats.TopCenter;
                    gfx.DrawString(values[c - 4], bodyFont, black, new XRect(cx + 1, ry + 2, cols[c] - 2, rowH), align);
                    cx += cols[c];
                }
            }
            y += blockH;
        }

        // Genel toplam satırı
        y += 6;
        var totalText = $"Kişi sayısı: {m.People.Count}    Kalem sayısı: {m.ItemCount}    Nakdi: {m.CashText}    Ayni: {m.AyniText}    GENEL TOPLAM: {m.TotalText}";
        gfx.DrawString(totalText, totalFont, black, new XRect(margin, y, cols.Sum(), 6), XStringFormats.TopRight);
        y += 12;

        // İmzalar: solda Onaylayan, ortada Kontrol Eden, sağda Düzenleyen
        double signTop = 210 - margin - 26;
        double colW = cols.Sum() / 3.0;
        string[] labels = { "Onaylayan", "Kontrol Eden", "Düzenleyen" };
        (string Name, string Title)[] signers = { m.Authority, m.Proposed, m.Editor };
        for (var i = 0; i < 3; i++)
        {
            var sx = margin + i * colW;
            gfx.DrawString(labels[i], totalFont, black, new XRect(sx, signTop, colW, 6), XStringFormats.TopCenter);
            gfx.DrawString(signers[i].Name, bodyFont, black, new XRect(sx, signTop + 14, colW, 5), XStringFormats.TopCenter);
            gfx.DrawString(signers[i].Title, bodyFont, black, new XRect(sx, signTop + 19, colW, 5), XStringFormats.TopCenter);
        }

        doc.Save(path);
    }
}

internal sealed class DistributionModel
{
    public string Title { get; private set; } = "";
    public string DateText { get; private set; } = "";
    public List<PersonRow> People { get; } = [];
    public int ItemCount { get; private set; }
    public string CashText { get; private set; } = "";
    public string AyniText { get; private set; } = "";
    public string TotalText { get; private set; } = "";
    public (string Name, string Title) Editor { get; private set; }
    public (string Name, string Title) Proposed { get; private set; }
    public (string Name, string Title) Authority { get; private set; }

    internal sealed class PersonRow
    {
        public string Name { get; init; } = "";
        public string Title { get; init; } = "";
        public string NationalId { get; init; } = "";
        public List<ItemRow> Items { get; } = [];
    }

    internal sealed class ItemRow
    {
        public string Name { get; init; } = "";
        public string AmountText { get; init; } = "";
        public string QuantityText { get; init; } = "";
    }

    public static DistributionModel? Load(string dataFile, string batchId)
    {
        using var doc = JsonDocument.Parse(File.ReadAllText(dataFile));
        var root = doc.RootElement;
        if (!root.TryGetProperty("batches", out var batches)) return null;

        JsonElement? found = null;
        foreach (var b in batches.EnumerateArray())
        {
            if (string.Equals(b.TryGetProperty("id", out var id) ? id.GetString() : null, batchId, StringComparison.Ordinal))
            {
                found = b;
                break;
            }
        }
        if (found is not { } batch) return null;

        var model = new DistributionModel();
        var tr = new CultureInfo("tr-TR");
        var instId = batch.TryGetProperty("institutionId", out var ii) ? ii.GetString() : null;
        var year = batch.TryGetProperty("year", out var yy) && yy.TryGetInt32(out var yv) ? yv : DateTime.Now.Year;
        var institutionName = "KURUM";
        var nationalIds = new Dictionary<string, string>(StringComparer.Ordinal);

        if (root.TryGetProperty("institutions", out var institutions))
            foreach (var inst in institutions.EnumerateArray())
            {
                var id = inst.TryGetProperty("id", out var iid) ? iid.GetString() : null;
                if (id == instId) institutionName = inst.TryGetProperty("name", out var nm) ? nm.GetString() ?? institutionName : institutionName;
            }
        if (root.TryGetProperty("staff", out var staff))
            foreach (var s in staff.EnumerateArray())
            {
                var id = s.TryGetProperty("id", out var sid) ? sid.GetString() : null;
                var tc = s.TryGetProperty("nationalId", out var nid) ? nid.GetString() : null;
                if (id is not null && !string.IsNullOrWhiteSpace(tc)) nationalIds[id] = tc!;
            }

        model.Title = $"{institutionName.ToUpper(tr)} {year} GİYİM YARDIMI ÖDEMESİ";
        var dateText = batch.TryGetProperty("date", out var d) ? d.GetString() : null;
        model.DateText = DateTime.TryParse(dateText, CultureInfo.InvariantCulture, DateTimeStyles.None, out var dt)
            ? dt.ToString("dd.MM.yyyy", tr) : dateText ?? "";

        decimal cash = 0, ayni = 0, total = 0;
        var people = new Dictionary<string, PersonRow>(StringComparer.Ordinal);
        var order = new List<string>();

        if (batch.TryGetProperty("details", out var details))
            foreach (var dz in details.EnumerateArray())
            {
                var staffId = dz.TryGetProperty("staffId", out var sid) ? sid.GetString() ?? "" : "";
                var name = dz.TryGetProperty("staffName", out var nm) ? nm.GetString() ?? "" : "";
                var title = dz.TryGetProperty("title", out var tt) ? tt.GetString() ?? "" : "";
                var item = dz.TryGetProperty("item", out var it) ? it.GetString() ?? "" : "";
                var mode = dz.TryGetProperty("mode", out var md) ? md.GetString() ?? "" : "";
                var qty = dz.TryGetProperty("quantity", out var qq) && qq.TryGetInt32(out var qv) ? Math.Max(1, qv) : 1;
                var amount = dz.TryGetProperty("amount", out var az) && az.TryGetDecimal(out var av) ? av : 0m;

                if (!people.TryGetValue(staffId, out var person))
                {
                    person = new PersonRow { Name = name, Title = title, NationalId = nationalIds.GetValueOrDefault(staffId, "") };
                    people[staffId] = person;
                    order.Add(staffId);
                }
                if (mode == "Ayni") ayni += amount; else cash += amount;
                total += amount;
                model.ItemCount++;
                person.Items.Add(new ItemRow
                {
                    Name = mode == "Ayni" ? item + " (AYNİ)" : item,
                    AmountText = amount.ToString("N2", tr),
                    QuantityText = qty.ToString(CultureInfo.InvariantCulture)
                });
            }

        foreach (var key in order) model.People.Add(people[key]);

        model.CashText = cash.ToString("N2", tr) + " TL";
        model.AyniText = ayni.ToString("N2", tr) + " TL";
        model.TotalText = total.ToString("N2", tr) + " TL";

        // İmzacılar: Harcama Birimi menüsü, yoksa eski ayarlar
        JsonElement settings = default;
        var hasSettings = root.TryGetProperty("spendingUnit", out settings) && settings.ValueKind == JsonValueKind.Object;
        if (!hasSettings) hasSettings = root.TryGetProperty("documentSettings", out settings) && settings.ValueKind == JsonValueKind.Object;

        string Read(string key, string fallback = "")
        {
            if (!hasSettings) return fallback;
            return settings.TryGetProperty(key, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() ?? fallback : fallback;
        }

        model.Editor = (Read("editorName"), Read("editorTitle"));
        model.Proposed = (Read("proposedName"), Read("proposedTitle"));
        model.Authority = (Read("authorityName"), Read("authorityTitle"));
        return model;
    }
}

internal sealed class WindowsFontResolver : IFontResolver
{
    public string DefaultFontName => "Arial";

    public FontResolverInfo ResolveTypeface(string familyName, bool isBold, bool isItalic)
        => new(isBold ? "Arial#b" : "Arial", isBold, false);

    public byte[]? GetFont(string faceName)
    {
        var fonts = Environment.GetFolderPath(Environment.SpecialFolder.Fonts);
        var file = faceName == "Arial#b" ? "arialbd.ttf" : "arial.ttf";
        var path = Path.Combine(fonts, file);
        if (!File.Exists(path)) path = Path.Combine(fonts, "segoeui.ttf");
        return File.Exists(path) ? File.ReadAllBytes(path) : null;
    }
}
