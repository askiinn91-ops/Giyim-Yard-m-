using System.Globalization;
using PdfSharpCore.Drawing;
using PdfSharpCore.Fonts;

namespace GiyimYardimi;

/// <summary>PDF çizimleri için ortak yardımcılar (mm↔pt, yazı sarma, para biçimi).</summary>
internal static class PdfDrawing
{
    public const double MmToPt = 72.0 / 25.4;

    public static readonly CultureInfo Tr = new("tr-TR");

    private static bool _fontReady;

    public static void EnsureFonts()
    {
        if (_fontReady) return;
        GlobalFontSettings.FontResolver = new WindowsFontResolver();
        _fontReady = true;
    }

    public static double Mm(double millimeters) => millimeters * MmToPt;

    public static string Money(decimal value) => value.ToString("N2", Tr);

    public static string MoneyTl(decimal value) => value.ToString("N2", Tr) + " TL";

    /// <summary>Metni verilen genişliğe sığacak satırlara böler.</summary>
    public static List<string> Wrap(XGraphics gfx, string text, XFont font, double maxWidth)
    {
        var lines = new List<string>();
        if (string.IsNullOrEmpty(text)) { lines.Add(""); return lines; }

        foreach (var paragraph in text.Replace("\r\n", "\n").Split('\n'))
        {
            if (paragraph.Length == 0) { lines.Add(""); continue; }
            var current = "";
            foreach (var word in paragraph.Split(' ', StringSplitOptions.RemoveEmptyEntries))
            {
                var candidate = current.Length == 0 ? word : current + " " + word;
                if (gfx.MeasureString(candidate, font).Width <= maxWidth || current.Length == 0)
                {
                    current = candidate;
                }
                else
                {
                    lines.Add(current);
                    current = word;
                }
            }
            lines.Add(current);
        }
        return lines;
    }

    /// <summary>Metni satır satır çizer; çizilen toplam yüksekliği döndürür.</summary>
    public static double DrawWrapped(XGraphics gfx, string text, XFont font, XBrush brush,
        double x, double y, double width, double lineHeight, XStringFormat? format = null)
    {
        var lines = Wrap(gfx, text, font, width);
        var current = y;
        foreach (var line in lines)
        {
            gfx.DrawString(line, font, brush, new XRect(x, current, width, lineHeight),
                format ?? XStringFormats.TopLeft);
            current += lineHeight;
        }
        return lines.Count * lineHeight;
    }

    public static int LineCount(XGraphics gfx, string text, XFont font, double width)
        => Wrap(gfx, text, font, width).Count;
}

/// <summary>Windows sistem yazı tiplerini (Arial) PDF'e gömer.</summary>
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
