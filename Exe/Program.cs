using System.Diagnostics;
using System.Net;
using System.Net.Sockets;
using System.Globalization;
using System.Reflection;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using UglyToad.PdfPig;

namespace GiyimYardimi;

internal static class Program
{
    [STAThread]
    private static void Main()
    {
        // Aynı anda iki kopya açılırsa aynı veri dosyasına yazan iki sunucu olur; bunu engelle.
        using var singleInstance = new Mutex(true, @"Local\GiyimYardimi.TekKopya", out var isFirstInstance);
        if (!isFirstInstance)
        {
            MessageBox.Show(
                "Giyim Yardımı Yönetimi bu bilgisayarda zaten açık.\n\n"
                + "Aynı anda iki kopya açıldığında veri dosyası bozulabilir. Açık olan pencereyi kullanın.",
                "Giyim Yardımı Yönetimi", MessageBoxButtons.OK, MessageBoxIcon.Information);
            return;
        }

        ApplicationConfiguration.Initialize();
        // Test veya ikinci bir çalışma kopyası için veri klasörü ortam değişkeniyle değiştirilebilir.
        var dataRoot = Environment.GetEnvironmentVariable("GIYIM_YARDIMI_DATA");
        if (string.IsNullOrWhiteSpace(dataRoot))
            dataRoot = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "GiyimYardimi");
        Directory.CreateDirectory(dataRoot);
        using var server = new LocalServer(Path.Combine(dataRoot, "veriler.json"));
        server.Start();
        if (!string.IsNullOrEmpty(server.StartupNotice))
            MessageBox.Show(server.StartupNotice, "Giyim Yardımı Yönetimi", MessageBoxButtons.OK, MessageBoxIcon.Warning);
        Application.Run(new MainForm(server.Address, Path.Combine(dataRoot, "WebView2"), server.BackupRoot));
    }
}

internal sealed class MainForm : Form
{
    private readonly WebView2 _web = new();
    private readonly string _address;
    private readonly string _webViewData;
    private readonly string _backupRoot;

    public MainForm(string address, string webViewData, string backupRoot)
    {
        _address = address;
        _webViewData = webViewData;
        _backupRoot = backupRoot;
        Text = "Giyim Yardımı Yönetimi";
        StartPosition = FormStartPosition.CenterScreen;
        MinimumSize = new Size(900, 620);
        Size = new Size(1440, 940);
        BackColor = Color.FromArgb(247, 249, 247);
        _web.Dock = DockStyle.Fill;
        Controls.Add(_web);
        Shown += InitializeBrowser;
    }

    private async void InitializeBrowser(object? sender, EventArgs e)
    {
        try
        {
            var environment = await CoreWebView2Environment.CreateAsync(null, _webViewData);
            await _web.EnsureCoreWebView2Async(environment);
            _web.CoreWebView2.Settings.AreDefaultContextMenusEnabled = true;
            _web.CoreWebView2.Settings.AreDevToolsEnabled = false;
            _web.CoreWebView2.Settings.IsStatusBarEnabled = false;
            _web.CoreWebView2.WebMessageReceived += async (_, args) => await HandleWebMessage(args.WebMessageAsJson);
            _web.CoreWebView2.NewWindowRequested += (_, args) =>
            {
                args.Handled = true;
                if (Uri.TryCreate(args.Uri, UriKind.Absolute, out var uri) && uri.Scheme == Uri.UriSchemeHttp && uri.Host == "127.0.0.1")
                    _web.CoreWebView2.Navigate(uri.ToString());
            };
            _web.CoreWebView2.Navigate(_address);
        }
        catch (Exception ex)
        {
            MessageBox.Show(this,
                "Uygulama penceresi başlatılamadı. Microsoft Edge WebView2 Runtime kurulumunu onarın veya güncelleyin.\n\n" + ex.Message,
                "Giyim Yardımı Yönetimi", MessageBoxButtons.OK, MessageBoxIcon.Error);
            Close();
        }
    }

    private async Task HandleWebMessage(string message)
    {
        try
        {
            using var doc = JsonDocument.Parse(message);
            if (!doc.RootElement.TryGetProperty("type", out var type)) return;
            if (type.GetString() == "openBackupFolder")
            {
                try
                {
                    Directory.CreateDirectory(_backupRoot);
                    Process.Start(new ProcessStartInfo("explorer.exe", $"\"{_backupRoot}\"") { UseShellExecute = true });
                }
                catch { }
                return;
            }
            if (type.GetString() == "importTariffPdf")
            {
                await ImportTariffPdfAsync();
                return;
            }
            if (type.GetString() != "exportPdf") return;
            var year = doc.RootElement.TryGetProperty("year", out var yearNode) && yearNode.TryGetInt32(out var y) ? y : DateTime.Now.Year;
            var institution = doc.RootElement.TryGetProperty("institution", out var institutionNode) ? institutionNode.GetString() ?? "Kurum" : "Kurum";
            var safeInstitution = new string(institution.Select(ch => Path.GetInvalidFileNameChars().Contains(ch) ? '_' : ch).ToArray()).Trim().TrimEnd('.');
            if (string.IsNullOrWhiteSpace(safeInstitution)) safeInstitution = "Kurum";
            var folder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), "Giyim Yardımı Çıktıları");
            Directory.CreateDirectory(folder);
            var stamp = DateTime.Now.ToString("yyyyMMdd_HHmmss");
            var talimatPath = Path.Combine(folder, $"Giyecek_{year}_{safeInstitution}_{stamp}_HarcamaTalimatı.pdf");
            var dagitimPath = Path.Combine(folder, $"Giyecek_{year}_{safeInstitution}_{stamp}_DağıtımListesi.pdf");
            try
            {
                await _web.CoreWebView2.ExecuteScriptAsync("document.body.dataset.exportPage='talimat'");
                var portrait = _web.CoreWebView2.Environment.CreatePrintSettings();
                portrait.ShouldPrintBackgrounds = true;
                portrait.ShouldPrintHeaderAndFooter = false;
                portrait.MediaSize = CoreWebView2PrintMediaSize.Custom;
                portrait.PageWidth = 8.27;
                portrait.PageHeight = 11.69;
                portrait.MarginTop = portrait.MarginBottom = portrait.MarginLeft = portrait.MarginRight = 0;
                portrait.Orientation = CoreWebView2PrintOrientation.Portrait;
                if (!await _web.CoreWebView2.PrintToPdfAsync(talimatPath, portrait))
                    throw new InvalidOperationException("Harcama talimatı PDF'si oluşturulamadı.");

                await _web.CoreWebView2.ExecuteScriptAsync("document.body.dataset.exportPage='dagitim'");
                var landscape = _web.CoreWebView2.Environment.CreatePrintSettings();
                landscape.ShouldPrintBackgrounds = true;
                landscape.ShouldPrintHeaderAndFooter = false;
                landscape.MediaSize = CoreWebView2PrintMediaSize.Custom;
                landscape.PageWidth = 11.69;
                landscape.PageHeight = 8.27;
                landscape.MarginTop = landscape.MarginBottom = landscape.MarginLeft = landscape.MarginRight = 0;
                landscape.Orientation = CoreWebView2PrintOrientation.Landscape;
                if (!await _web.CoreWebView2.PrintToPdfAsync(dagitimPath, landscape))
                    throw new InvalidOperationException("Dağıtım listesi PDF'si oluşturulamadı.");

                var callback = "window.pdfSaved&&window.pdfSaved(" + JsonSerializer.Serialize(new[] { talimatPath, dagitimPath }) + ")";
                await _web.CoreWebView2.ExecuteScriptAsync(callback);
            }
            finally
            {
                await _web.CoreWebView2.ExecuteScriptAsync("delete document.body.dataset.exportPage");
            }
        }
        catch (Exception ex)
        {
            var callback = "window.pdfFailed&&window.pdfFailed(" + JsonSerializer.Serialize(ex.Message) + ")";
            try { await _web.CoreWebView2.ExecuteScriptAsync(callback); } catch { }
        }
    }

    private async Task ImportTariffPdfAsync()
    {
        using var picker = new OpenFileDialog
        {
            Title = "Hazine ve Maliye Bakanlığı giyecek fiyat listesi PDF dosyalarını seçin",
            Filter = "PDF dosyaları (*.pdf)|*.pdf",
            Multiselect = true,
            CheckFileExists = true
        };
        if (picker.ShowDialog(this) != DialogResult.OK) return;

        try
        {
            var result = await Task.Run(() => TariffPdfReader.Read(picker.FileNames));
            var script = "window.pdfTariffsLoaded&&window.pdfTariffsLoaded(" + JsonSerializer.Serialize(result, new JsonSerializerOptions(JsonSerializerDefaults.Web)) + ")";
            await _web.CoreWebView2.ExecuteScriptAsync(script);
        }
        catch (Exception ex)
        {
            var script = "window.pdfImportFailed&&window.pdfImportFailed(" + JsonSerializer.Serialize(ex.Message) + ")";
            await _web.CoreWebView2.ExecuteScriptAsync(script);
        }
    }
}

internal static class TariffPdfReader
{
    private static readonly Regex RowPattern = new(@"^\s*(?<number>\d{1,3})\s+(?<item>.+?)\s+(?<amount>\d[\d.]*,\d{2})\s*$", RegexOptions.Compiled);
    private static readonly Regex YearPattern = new(@"\b(?<year>20\d{2})\s*(?:YILI|YIL)\b", RegexOptions.Compiled | RegexOptions.IgnoreCase);

    public static PdfPriceImportResult Read(string[] paths)
    {
        var sheets = new Dictionary<(int Year, string Mode), PdfPriceSheetBuilder>();
        var errors = new List<string>();

        foreach (var path in paths)
        {
            try
            {
                using var document = PdfDocument.Open(path);
                string? activeMode = null;
                foreach (var page in document.GetPages())
                {
                    var pageText = UglyToad.PdfPig.DocumentLayoutAnalysis.TextExtractor.ContentOrderTextExtractor.GetText(page);
                    var normalizedText = Normalize(pageText);
                    var modeInPage = DetectMode(normalizedText);
                    if (modeInPage is not null) activeMode = modeInPage;

                    var yearMatch = YearPattern.Match(normalizedText);
                    if (!yearMatch.Success) continue;
                    var year = int.Parse(yearMatch.Groups["year"].Value, CultureInfo.InvariantCulture);

                    if (activeMode is null) continue;
                    var key = (year, activeMode);
                    if (!sheets.TryGetValue(key, out var sheet))
                    {
                        sheet = new PdfPriceSheetBuilder(Path.GetFileName(path), year, activeMode);
                        sheets.Add(key, sheet);
                    }

                    foreach (var line in GetVisualLines(page))
                    {
                        var match = RowPattern.Match(line);
                        if (!match.Success || !int.TryParse(match.Groups["number"].Value, out var rowNumber) || rowNumber is < 1 or > 100) continue;
                        var item = Regex.Replace(match.Groups["item"].Value, @"\s+", " ").Trim(' ', ':', ';', '|');
                        var priceText = match.Groups["amount"].Value.Replace(".", "", StringComparison.Ordinal).Replace(',', '.');
                        if (item.Length < 2 || !decimal.TryParse(priceText, NumberStyles.AllowDecimalPoint, CultureInfo.InvariantCulture, out var amount) || amount <= 0) continue;
                        sheet.Add(rowNumber, item, amount);
                    }
                }
            }
            catch (Exception ex)
            {
                errors.Add($"{Path.GetFileName(path)}: {ex.Message}");
            }
        }

        var resultSheets = sheets.Values.OrderBy(x => x.Year).ThenBy(x => x.Mode).Select(x => x.Build()).ToList();
        if (resultSheets.Count == 0 && errors.Count == 0)
            errors.Add("PDF içinde okunabilir fiyat satırı bulunamadı. Dosyanın metin içeren Bakanlık PDF'si olduğundan emin olun; taranmış görüntü PDF'leri desteklenmiyor.");
        return new PdfPriceImportResult(resultSheets, errors);
    }

    private static string? DetectMode(string text)
    {
        if (text.Contains("AYNI OLARAK YAPILACAK GIYECEK YARDIMI", StringComparison.Ordinal) || text.Contains("AYNI OLARAK YAPILACAK GIYIM YARDIMI", StringComparison.Ordinal)) return "Ayni";
        if (text.Contains("NAKDI OLARAK YAPILACAK GIYECEK YARDIMI", StringComparison.Ordinal) || text.Contains("NAKDI OLARAK YAPILACAK GIYIM YARDIMI", StringComparison.Ordinal)) return "Nakdi";
        return null;
    }

    private static string Normalize(string value)
    {
        var decomposed = value.Normalize(NormalizationForm.FormD);
        var builder = new StringBuilder(decomposed.Length);
        foreach (var ch in decomposed)
            if (CharUnicodeInfo.GetUnicodeCategory(ch) != UnicodeCategory.NonSpacingMark)
                builder.Append(ch);
        return builder.ToString().ToUpperInvariant().Replace('İ', 'I').Replace('ı', 'I');
    }

    private static IEnumerable<string> GetVisualLines(UglyToad.PdfPig.Content.Page page)
    {
        var lines = new List<PdfTextLine>();
        foreach (var word in page.GetWords().OrderByDescending(x => x.BoundingBox.Bottom).ThenBy(x => x.BoundingBox.Left))
        {
            var baseline = word.BoundingBox.Bottom;
            var line = lines.LastOrDefault(x => Math.Abs(x.Baseline - baseline) <= 2.0);
            if (line is null)
            {
                line = new PdfTextLine(baseline);
                lines.Add(line);
            }
            line.Words.Add((word.BoundingBox.Left, word.Text));
        }
        return lines.OrderByDescending(x => x.Baseline)
            .Select(x => string.Join(" ", x.Words.OrderBy(w => w.Left).Select(w => w.Text)));
    }

    private sealed class PdfTextLine(double baseline)
    {
        public double Baseline { get; } = baseline;
        public List<(double Left, string Text)> Words { get; } = [];
    }

    private sealed class PdfPriceSheetBuilder(string fileName, int year, string mode)
    {
        private readonly Dictionary<int, PdfTariffRow> _rows = [];
        private readonly List<string> _warnings = [];

        public string FileName { get; } = fileName;
        public int Year { get; } = year;
        public string Mode { get; } = mode;

        public void Add(int rowNumber, string item, decimal amount)
        {
            if (_rows.TryGetValue(rowNumber, out var existing))
            {
                if (!string.Equals(existing.Item, item, StringComparison.OrdinalIgnoreCase) || existing.Amount != amount)
                    _warnings.Add($"{rowNumber}. sıra birden fazla ve farklı değerle okundu.");
                return;
            }
            _rows.Add(rowNumber, new PdfTariffRow(rowNumber, item, amount));
        }

        public PdfPriceSheet Build() => new(FileName, Year, Mode, _rows.Values.OrderBy(x => x.RowNumber).ToList(), _warnings.Distinct().ToList());
    }
}

internal sealed record PdfPriceImportResult(List<PdfPriceSheet> Sheets, List<string> Errors);
internal sealed record PdfPriceSheet(string FileName, int Year, string Mode, List<PdfTariffRow> Rows, List<string> Warnings);
internal sealed record PdfTariffRow(int RowNumber, string Item, decimal Amount);

internal sealed class LocalServer : IDisposable
{
    private const int MaxAutoBackups = 20;
    private const int MaxDailyBackups = 30;

    private readonly TcpListener _listener = new(IPAddress.Loopback, 0);
    private readonly string _dataFile;
    private readonly string _backupRoot;
    private readonly CancellationTokenSource _stop = new();
    private Task? _loop;
    private static readonly byte[] InitialData = Encoding.UTF8.GetBytes("{\"institutions\":[],\"staff\":[],\"tariffs\":[],\"years\":[],\"batches\":[]}");
    private static readonly string[] RequiredCollections = ["institutions", "staff", "tariffs", "years", "batches"];
    private static readonly Dictionary<string, string> MimeTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        [".html"] = "text/html; charset=utf-8",
        [".js"] = "text/javascript; charset=utf-8",
        [".css"] = "text/css; charset=utf-8"
    };

    public string Address { get; private set; } = "";
    public string BackupRoot => _backupRoot;
    public string? StartupNotice { get; private set; }

    public LocalServer(string dataFile)
    {
        _dataFile = dataFile;
        _backupRoot = Path.Combine(Path.GetDirectoryName(dataFile) ?? ".", "yedekler");
    }

    public void Start()
    {
        _listener.Start();
        Address = $"http://127.0.0.1:{((IPEndPoint)_listener.LocalEndpoint).Port}/";
        PrepareDataFile();
        _loop = Task.Run(AcceptLoop);
    }

    /// <summary>Veri dosyasını doğrular; bozuksa son geçerli yedeğe döner.</summary>
    private void PrepareDataFile()
    {
        try { Directory.CreateDirectory(_backupRoot); } catch { }

        if (!File.Exists(_dataFile))
        {
            File.WriteAllBytes(_dataFile, InitialData);
            return;
        }
        if (IsValidDataFile(_dataFile)) return;

        var brokenName = Path.Combine(_backupRoot, $"veriler-BOZUK-{DateTime.Now:yyyyMMdd-HHmmss}.json");
        try { File.Move(_dataFile, brokenName, true); } catch { }

        var restored = Directory.GetFiles(_backupRoot, "veriler-*.json", SearchOption.AllDirectories)
            .Where(path => !Path.GetFileName(path).StartsWith("veriler-BOZUK-", StringComparison.Ordinal))
            .Where(IsValidDataFile)
            .OrderByDescending(path => Path.GetFileName(path), StringComparer.Ordinal)
            .FirstOrDefault();

        if (restored is not null)
        {
            File.Copy(restored, _dataFile, true);
            StartupNotice = "Veri dosyası okunamadığı için son geçerli yedek geri yüklendi.\n\n"
                + $"Geri yüklenen yedek: {Path.GetFileName(restored)}\n"
                + $"Bozuk dosya: {Path.GetFileName(brokenName)}\n\n"
                + "Kayıtları kontrol edip yeniden yedek almanız önerilir.";
            return;
        }

        File.WriteAllBytes(_dataFile, InitialData);
        StartupNotice = "Veri dosyası okunamadı ve kullanılabilir yedek bulunamadı. Boş bir veri dosyası oluşturuldu.\n\n"
            + $"Bozuk dosya: {Path.GetFileName(brokenName)}\nKlasör: {_backupRoot}";
    }

    private static bool IsValidDataFile(string path)
    {
        try
        {
            using var stream = File.OpenRead(path);
            using var doc = JsonDocument.Parse(stream);
            foreach (var key in RequiredCollections)
                if (!doc.RootElement.TryGetProperty(key, out var value) || value.ValueKind != JsonValueKind.Array)
                    return false;
            return true;
        }
        catch { return false; }
    }

    /// <summary>Her kayıttan önce dönüşümlü yedek alır: son 20 kayıt + 30 günlük günlük kopya.</summary>
    private void BackupCurrent()
    {
        try
        {
            if (!File.Exists(_dataFile)) return;
            var now = DateTime.Now;

            var autoFolder = Path.Combine(_backupRoot, "otomatik");
            Directory.CreateDirectory(autoFolder);
            var snapshot = Path.Combine(autoFolder, $"veriler-{now:yyyyMMdd-HHmmss}.json");
            var suffix = 1;
            while (File.Exists(snapshot))
                snapshot = Path.Combine(autoFolder, $"veriler-{now:yyyyMMdd-HHmmss}-{suffix++}.json");
            File.Copy(_dataFile, snapshot, false);
            TrimFolder(autoFolder, MaxAutoBackups);

            var dailyFolder = Path.Combine(_backupRoot, "gunluk");
            Directory.CreateDirectory(dailyFolder);
            File.Copy(_dataFile, Path.Combine(dailyFolder, $"veriler-{now:yyyyMMdd}.json"), true);
            TrimFolder(dailyFolder, MaxDailyBackups);
        }
        catch
        {
            // Yedek alınamaması kayıt işlemini engellemez.
        }
    }

    private static void TrimFolder(string folder, int keep)
    {
        foreach (var old in Directory.GetFiles(folder, "veriler-*.json")
                     .OrderByDescending(path => Path.GetFileName(path), StringComparer.Ordinal)
                     .Skip(keep))
        {
            try { File.Delete(old); } catch { }
        }
    }

    private async Task AcceptLoop()
    {
        while (!_stop.IsCancellationRequested)
        {
            TcpClient client;
            try { client = await _listener.AcceptTcpClientAsync(_stop.Token); }
            catch (OperationCanceledException) { break; }
            catch (SocketException) { break; }
            _ = Task.Run(() => Handle(client));
        }
    }

    private async Task Handle(TcpClient client)
    {
        using (client)
        using (var stream = client.GetStream())
        {
            try
            {
                var headBytes = new List<byte>(512);
                var marker = 0;
                while (marker < 4 && headBytes.Count < 32768)
                {
                    var value = stream.ReadByte();
                    if (value < 0) return;
                    headBytes.Add((byte)value);
                    marker = (marker, value) switch
                    {
                        (0, 13) => 1,
                        (1, 10) => 2,
                        (2, 13) => 3,
                        (3, 10) => 4,
                        (_, 13) => 1,
                        _ => 0
                    };
                }
                if (marker != 4) { await Respond(stream, 400, "Bad Request", "text/plain", []); return; }
                var lines = Encoding.ASCII.GetString(headBytes.ToArray()).Split("\r\n", StringSplitOptions.None);
                var request = lines[0].Split(' ', StringSplitOptions.RemoveEmptyEntries);
                if (request.Length < 2) { await Respond(stream, 400, "Bad Request", "text/plain", []); return; }
                var method = request[0];
                var path = Uri.UnescapeDataString(request[1].Split('?')[0]);
                var length = 0;
                foreach (var line in lines)
                    if (line.StartsWith("Content-Length:", StringComparison.OrdinalIgnoreCase) && int.TryParse(line.AsSpan(15).Trim(), out var n)) length = Math.Clamp(n, 0, 32_000_000);
                var body = new byte[length];
                var read = 0;
                while (read < body.Length)
                {
                    var n = await stream.ReadAsync(body.AsMemory(read, body.Length - read), _stop.Token);
                    if (n == 0) break;
                    read += n;
                }

                if (method == "GET" && path == "/api/data")
                {
                    await Respond(stream, 200, "OK", "application/json; charset=utf-8", await File.ReadAllBytesAsync(_dataFile));
                    return;
                }
                if (method == "POST" && path == "/api/data")
                {
                    var json = Encoding.UTF8.GetString(body, 0, read);
                    using var doc = JsonDocument.Parse(json);
                    foreach (var key in RequiredCollections)
                        if (!doc.RootElement.TryGetProperty(key, out var value) || value.ValueKind != JsonValueKind.Array)
                            throw new InvalidDataException("Unexpected data format");
                    BackupCurrent();
                    var temp = _dataFile + ".tmp";
                    await File.WriteAllTextAsync(temp, json, new UTF8Encoding(false));
                    File.Move(temp, _dataFile, true);
                    await Respond(stream, 200, "OK", "application/json; charset=utf-8", Encoding.UTF8.GetBytes("{\"saved\":true}"));
                    return;
                }
                if (method == "GET")
                {
                    var name = path == "/" ? "index.html" : path.TrimStart('/');
                    if (name is "index.html" or "app.js" or "styles.css" or "print.css")
                    {
                        var data = ReadAsset(name);
                        var extension = Path.GetExtension(name);
                        await Respond(stream, 200, "OK", MimeTypes.GetValueOrDefault(extension, "application/octet-stream"), data);
                        return;
                    }
                }
                await Respond(stream, 404, "Not Found", "text/plain; charset=utf-8", Encoding.UTF8.GetBytes("Not found"));
            }
            catch (OperationCanceledException) { }
            catch (Exception)
            {
                try { await Respond(stream, 500, "Internal Server Error", "application/json; charset=utf-8", Encoding.UTF8.GetBytes("{\"error\":\"request_failed\"}")); } catch { }
            }
        }
    }

    private static byte[] ReadAsset(string name)
    {
        using var resource = Assembly.GetExecutingAssembly().GetManifestResourceStream("GiyimYardimi." + name)
            ?? throw new FileNotFoundException("Embedded application file not found", name);
        using var output = new MemoryStream();
        resource.CopyTo(output);
        return output.ToArray();
    }

    private static async Task Respond(NetworkStream stream, int status, string reason, string type, byte[] body)
    {
        var header = Encoding.ASCII.GetBytes($"HTTP/1.1 {status} {reason}\r\nContent-Type: {type}\r\nContent-Length: {body.Length}\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\nConnection: close\r\n\r\n");
        await stream.WriteAsync(header);
        if (body.Length > 0) await stream.WriteAsync(body);
        await stream.FlushAsync();
    }

    public void Dispose()
    {
        _stop.Cancel();
        _listener.Stop();
        try { _loop?.Wait(TimeSpan.FromSeconds(2)); } catch { }
        _stop.Dispose();
    }
}
