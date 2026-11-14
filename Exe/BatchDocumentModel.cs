using System.Globalization;
using System.Text.Json;

namespace GiyimYardimi;

/// <summary>
/// Harcama talimatı ve dağıtım listesi PDF'lerinin ortak veri modeli.
/// Kayıtlı ödeme (batch), kurum, personel ve harcama birimi ayarlarından beslenir.
/// </summary>
internal sealed class BatchDocumentModel
{
    public string BatchId { get; private set; } = "";
    public int Year { get; private set; }
    public string DateText { get; private set; } = "";
    public string Number { get; private set; } = "1";
    public string InstitutionName { get; private set; } = "KURUM";
    public string UnitName { get; private set; } = "";
    public string KaymakamlikName { get; private set; } = "";
    public string Basis { get; private set; } = "";
    public string Subject { get; private set; } = "";
    public string Quantity { get; private set; } = "";
    public string Period { get; private set; } = "";
    public string Method { get; private set; } = "";
    public string Budget { get; private set; } = "";
    public string Officers { get; private set; } = "";
    public string Explanation { get; private set; } = "";
    public decimal Amount { get; private set; }
    public decimal Appropriation { get; private set; }
    public List<Row> Rows { get; } = [];
    public int PersonCount { get; private set; }
    public decimal GrossTotal { get; private set; }
    public decimal StampTotal { get; private set; }
    public decimal NetTotal { get; private set; }
    public decimal CashTotal { get; private set; }
    public decimal AyniTotal { get; private set; }
    public Signer Editor { get; private set; }
    public Signer Proposed { get; private set; }
    public Signer Authority { get; private set; }

    internal sealed class Row
    {
        public string Name { get; init; } = "";
        public string Title { get; init; } = "";
        public string ServiceClass { get; init; } = "";
        public string Item { get; init; } = "";
        public string Mode { get; init; } = "";
        public int Quantity { get; init; }
        public decimal Gross { get; init; }
        public decimal Stamp { get; init; }
        public decimal Net { get; init; }
    }

    internal readonly record struct Signer(string Name, string Title);

    public static BatchDocumentModel? Load(string dataFile, string batchId)
    {
        using var doc = JsonDocument.Parse(File.ReadAllText(dataFile));
        var root = doc.RootElement;
        if (!root.TryGetProperty("batches", out var batches)) return null;

        JsonElement? found = null;
        foreach (var b in batches.EnumerateArray())
        {
            if (string.Equals(Str(b, "id"), batchId, StringComparison.Ordinal)) { found = b; break; }
        }
        if (found is not { } batch) return null;

        var tr = new CultureInfo("tr-TR");
        var model = new BatchDocumentModel
        {
            BatchId = batchId,
            Year = batch.TryGetProperty("year", out var yy) && yy.TryGetInt32(out var yv) ? yv : DateTime.Now.Year,
            Number = string.IsNullOrWhiteSpace(Str(batch, "number")) ? "1" : Str(batch, "number")
        };

        var dateText = Str(batch, "date");
        model.DateText = DateTime.TryParse(dateText, CultureInfo.InvariantCulture, DateTimeStyles.None, out var dt)
            ? dt.ToString("dd.MM.yyyy", tr)
            : dateText;

        var instId = Str(batch, "institutionId");
        if (root.TryGetProperty("institutions", out var institutions))
        {
            foreach (var inst in institutions.EnumerateArray())
            {
                if (string.Equals(Str(inst, "id"), instId, StringComparison.Ordinal))
                {
                    model.InstitutionName = Str(inst, "name", model.InstitutionName);
                    break;
                }
            }
        }

        // Harcama birimi ayarları (yeni: spendingUnit, eski: documentSettings)
        var settings = default(JsonElement);
        var hasSettings = root.TryGetProperty("spendingUnit", out settings) && settings.ValueKind == JsonValueKind.Object;
        if (!hasSettings) hasSettings = root.TryGetProperty("documentSettings", out settings) && settings.ValueKind == JsonValueKind.Object;

        string Setting(string key, string fallback = "")
            => hasSettings ? Str(settings, key, fallback) : fallback;

        // Kayda özel harcama bilgileri
        var harcama = default(JsonElement);
        var hasHarcama = batch.TryGetProperty("harcama", out harcama) && harcama.ValueKind == JsonValueKind.Object;

        string From(string key, string fallback = "")
            => hasHarcama ? Str(harcama, key, fallback) : fallback;

        model.UnitName = FirstNonEmpty(From("unit"), Setting("name"), "İlçe Millî Eğitim Müdürlüğü");
        model.Basis = FirstNonEmpty(From("basis"), Setting("basis"));
        model.Subject = FirstNonEmpty(From("subject"), $"{model.Year} yılı giyecek yardımı ödemesi");
        model.Period = FirstNonEmpty(From("period"), model.Year.ToString(CultureInfo.InvariantCulture));
        model.Method = FirstNonEmpty(From("method"), "Nakdi");
        model.Budget = FirstNonEmpty(From("budget"), Setting("budget"));
        model.Officers = FirstNonEmpty(From("officers"), Setting("proposedName"));
        model.KaymakamlikName = DeriveKaymakamlik(model.UnitName);

        model.Editor = new Signer(FirstNonEmpty(From("editorName"), Setting("editorName")), FirstNonEmpty(From("editorTitle"), Setting("editorTitle")));
        model.Proposed = new Signer(FirstNonEmpty(From("proposedName"), Setting("proposedName")), FirstNonEmpty(From("proposedTitle"), Setting("proposedTitle")));
        model.Authority = new Signer(FirstNonEmpty(From("authorityName"), Setting("authorityName")), FirstNonEmpty(From("authorityTitle"), Setting("authorityTitle")));

        var people = new HashSet<string>(StringComparer.Ordinal);
        if (batch.TryGetProperty("details", out var details))
        {
            foreach (var dz in details.EnumerateArray())
            {
                var mode = Str(dz, "mode");
                var qty = dz.TryGetProperty("quantity", out var qq) && qq.TryGetInt32(out var qv) ? Math.Max(1, qv) : 1;
                var gross = dz.TryGetProperty("amount", out var az) && az.TryGetDecimal(out var av) ? av : 0m;
                var stamp = dz.TryGetProperty("stampTax", out var sz) && sz.TryGetDecimal(out var sv) ? sv : 0m;
                var net = dz.TryGetProperty("net", out var nz) && nz.TryGetDecimal(out var nv) && nv > 0 ? nv : gross - stamp;

                model.Rows.Add(new Row
                {
                    Name = Str(dz, "staffName"),
                    Title = Str(dz, "title"),
                    ServiceClass = Str(dz, "serviceClass"),
                    Item = Str(dz, "item"),
                    Mode = mode,
                    Quantity = qty,
                    Gross = gross,
                    Stamp = stamp,
                    Net = net
                });

                var staffId = Str(dz, "staffId");
                if (!string.IsNullOrEmpty(staffId)) people.Add(staffId);
                if (mode == "Ayni") model.AyniTotal += gross; else model.CashTotal += gross;
                model.GrossTotal += gross;
                model.StampTotal += stamp;
                model.NetTotal += net;
            }
        }

        model.PersonCount = people.Count;
        model.Amount = hasHarcama && harcama.TryGetProperty("amount", out var am) && am.TryGetDecimal(out var amv) ? amv : model.GrossTotal;
        model.Appropriation = hasHarcama && harcama.TryGetProperty("appropriation", out var ap) && ap.TryGetDecimal(out var apv) ? apv : model.Amount;
        model.Quantity = FirstNonEmpty(From("quantity"), $"{model.PersonCount} kişi");
        model.Explanation = FirstNonEmpty(From("explanation"),
            $"{model.InstitutionName} bünyesinde görev yapan ve giyim yardımından faydalanacak personele ait harcama talimatıdır.");

        return model;
    }

    /// <summary>"Sivaslı İlçe Millî Eğitim Müdürlüğü" → "SİVASLI KAYMAKAMLIĞI"</summary>
    private static string DeriveKaymakamlik(string unitName)
    {
        if (string.IsNullOrWhiteSpace(unitName)) return "";
        var upper = unitName.ToUpper(new CultureInfo("tr-TR"));
        var index = upper.IndexOf("İLÇE", StringComparison.Ordinal);
        var district = index > 0 ? upper[..index].Trim() : "";
        if (string.IsNullOrWhiteSpace(district))
        {
            var first = upper.Split(' ', StringSplitOptions.RemoveEmptyEntries).FirstOrDefault() ?? "";
            district = first;
        }
        return string.IsNullOrWhiteSpace(district) ? "" : district + " KAYMAKAMLIĞI";
    }

    private static string FirstNonEmpty(params string[] values)
        => values.FirstOrDefault(v => !string.IsNullOrWhiteSpace(v)) ?? "";

    private static string Str(JsonElement element, string key, string fallback = "")
        => element.ValueKind == JsonValueKind.Object
           && element.TryGetProperty(key, out var value)
           && value.ValueKind == JsonValueKind.String
            ? value.GetString() ?? fallback
            : fallback;
}
