using System.ComponentModel.DataAnnotations;

namespace PulseDeck.Models;

public abstract class ItemAudio
{
    public string Id { get; init; } = Guid.NewGuid().ToString("N");
    public string Titulo { get; init; } = "";
    public int DuracionSegundos { get; init; }
}

public sealed class PistaMusical : ItemAudio
{
    public string Artista { get; init; } = "";
    public int Bpm { get; init; }
    public int Prioridad { get; init; }
    public string ThumbnailUrl { get; init; } = "";
    public string AudioPreviewUrl { get; init; } = "";
}

public sealed class PistaSolicitud
{
    [Required, StringLength(200)] public string Titulo { get; set; } = "";
    [Required, StringLength(200)] public string Artista { get; set; } = "";
    [Range(1, 86400)] public int DuracionSegundos { get; set; }
    [Range(1, 999)] public int Bpm { get; set; }
    [Range(1, 5)] public int Prioridad { get; set; }
    [StringLength(2048)] public string ThumbnailUrl { get; set; } = "";
    [StringLength(2048)] public string AudioPreviewUrl { get; set; } = "";

    public PistaMusical Crear(string? id = null)
    {
        if (string.IsNullOrWhiteSpace(Titulo) || string.IsNullOrWhiteSpace(Artista))
            throw new ArgumentException("Título y artista son obligatorios.");
        ValidarUrl(ThumbnailUrl); ValidarUrl(AudioPreviewUrl);
        return new PistaMusical { Id = id ?? Guid.NewGuid().ToString("N"), Titulo = Titulo.Trim(),
            Artista = Artista.Trim(), DuracionSegundos = DuracionSegundos, Bpm = Bpm,
            Prioridad = Prioridad, ThumbnailUrl = ThumbnailUrl, AudioPreviewUrl = AudioPreviewUrl };
    }
    private static void ValidarUrl(string url)
    {
        if (url != "" && (!Uri.TryCreate(url, UriKind.Absolute, out var uri) ||
            (uri.Scheme != "https" && uri.Scheme != "http")))
            throw new ArgumentException("Las URLs deben ser HTTP o HTTPS, o estar vacías.");
    }
}

public sealed record NodoDto(int Indice, string IdActual, string IdSiguiente, PistaMusical Pista);
public sealed record EstadoCola(IEnumerable<NodoDto> Nodos, int Cantidad, PistaMusical? PistaActual, string UltimoLog);
public sealed record CoincidenciaDto(int Indice, int Saltos, PistaMusical Pista);
public sealed record BusquedaDto(IEnumerable<CoincidenciaDto> Coincidencias, int SaltosTotales);
