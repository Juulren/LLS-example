using PulseDeck.DataStructures;
using PulseDeck.Models;

namespace PulseDeck.Services;

public interface IColaMusicalService
{
    EstadoCola Obtener();
    EstadoCola Insertar(PistaSolicitud pista, string destino, int posicion = 0);
    EstadoCola Actualizar(string id, PistaSolicitud pista);
    EstadoCola Eliminar(string destino, string? id = null);
    EstadoCola Invertir();
    EstadoCola Mover(string id, int posicion);
    EstadoCola Ordenar(string criterio, bool asc);
    BusquedaDto Buscar(string texto);
}

public sealed class ColaMusicalService : IColaMusicalService
{
    private readonly object sync = new();
    private readonly ListaLigadaSimple<PistaMusical> cola = new(p => p.Id);
    private PistaMusical? actual;
    private string log = "[C# InsertarFinal] → 5 pistas enlazadas · sistema listo";
    public ColaMusicalService() => Inicializar();
    private EstadoCola Estado()
    {
        // Copia enlazada: ningún iterador escapa sobre nodos mutables de la cola.
        Nodo<NodoDto>? cabeza = null, ultimo = null;
        var nodo = cola.Cabeza; var indice = 0;
        while (nodo is not null)
        {
            var nuevo = new Nodo<NodoDto>(new NodoDto(indice++, nodo.Dato.Id, nodo.Siguiente?.Dato.Id ?? "NULL", nodo.Dato));
            if (ultimo is null) cabeza = nuevo;
            else ultimo.Siguiente = nuevo;
            ultimo = nuevo;
            nodo = nodo.Siguiente;
        }
        return new EstadoCola(Recorrer(cabeza), cola.Cantidad, actual, log);
    }
    private static IEnumerable<T> Recorrer<T>(Nodo<T>? nodo)
    {
        while (nodo is not null) { yield return nodo.Dato; nodo = nodo.Siguiente; }
    }
    public EstadoCola Obtener() { lock (sync) return Estado(); }
    public EstadoCola Mover(string id, int posicion)
    {
        lock (sync)
        {
            cola.MoverPorId(id, posicion);
            log = $"[C# MoverPorId] → Nodo reenlazado en posición {posicion} · O(n)";
            return Estado();
        }
    }
    public EstadoCola Insertar(PistaSolicitud pista, string destino, int posicion = 0)
    {
        lock (sync)
        {
            var nueva = pista.Crear();
            switch (destino)
            {
                case "inicio": cola.InsertarInicio(nueva); log = "[C# InsertarInicio] → Cabeza actualizada · O(1)"; break;
                case "final": cola.InsertarFinal(nueva); log = "[C# InsertarFinal] → Último.Siguiente enlazado · O(n)"; break;
                case "posicion": cola.InsertarEnPosicion(nueva, posicion); log = $"[C# InsertarEnPosicion] → Nodo intercalado en {posicion} · O(n)"; break;
                default: throw new ArgumentException("Destino inválido.");
            }
            return Estado();
        }
    }
    public EstadoCola Actualizar(string id, PistaSolicitud pista)
    {
        lock (sync) { cola.ActualizarPorId(id, pista.Crear(id)); log = "[C# ActualizarPorId] → Dato actualizado; ID conservado · O(n)"; return Estado(); }
    }
    public EstadoCola Eliminar(string destino, string? id = null)
    {
        lock (sync)
        {
            if (destino == "inicio") { actual = cola.EliminarInicio(); log = "[C# EliminarInicio] → Cabeza = Cabeza.Siguiente; pista al reproductor · O(1)"; }
            else if (destino == "final") { cola.EliminarFinal(); log = "[C# EliminarFinal] → Penúltimo.Siguiente = NULL · O(n)"; }
            else { cola.EliminarPorId(id!); log = "[C# EliminarPorId] → Anterior.Siguiente = Actual.Siguiente · O(n)"; }
            return Estado();
        }
    }
    public EstadoCola Invertir()
    {
        lock (sync) { cola.Invertir(); log = "[C# Invertir] → Punteros invertidos in-place · O(n)"; return Estado(); }
    }
    public EstadoCola Ordenar(string criterio, bool asc)
    {
        lock (sync)
        {
            Func<PistaMusical, PistaMusical, int> comparar = criterio switch {
                "bpm" => (a,b) => a.Bpm.CompareTo(b.Bpm),
                "duracion" => (a,b) => a.DuracionSegundos.CompareTo(b.DuracionSegundos),
                "prioridad" => (a,b) => a.Prioridad.CompareTo(b.Prioridad),
                _ => throw new ArgumentException("Criterio válido: bpm, duracion o prioridad.") };
            cola.OrdenarMergeSort((a,b) => asc ? comparar(a,b) : comparar(b,a));
            log = $"[C# OrdenarMergeSort] → {criterio} {(asc ? "↑" : "↓")} · nodos reenlazados · O(n log n)";
            return Estado();
        }
    }
    public BusquedaDto Buscar(string texto)
    {
        lock (sync)
        {
            var resultado = cola.BuscarSecuencial(p => p.Titulo.Contains(texto, StringComparison.OrdinalIgnoreCase) || p.Artista.Contains(texto, StringComparison.OrdinalIgnoreCase));
            return new BusquedaDto(Mapear(resultado.Coincidencias.Cabeza), resultado.SaltosTotales);
        }
    }
    private static IEnumerable<CoincidenciaDto> Mapear(Nodo<Hallazgo<PistaMusical>>? nodo)
    {
        while (nodo is not null) { yield return new CoincidenciaDto(nodo.Dato.Indice, nodo.Dato.Indice, nodo.Dato.Dato); nodo = nodo.Siguiente; }
    }
    private void Inicializar()
    {
        cola.InsertarFinal(new PistaMusical { Titulo = "One More Time", Artista = "Daft Punk", DuracionSegundos = 320, Bpm = 123, Prioridad = 1, ThumbnailUrl = "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/fd/4a/77/fd4a77db-0ebc-d043-41a2-f32fa1bb0fb4/dj.qrikkdwj.jpg/600x600bb.jpg", AudioPreviewUrl = "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/5d/93/d8/5d93d83f-ad1e-da4d-1d79-9937bdff24ec/mzaf_14396932211949300852.plus.aac.p.m4a" });
        cola.InsertarFinal(new PistaMusical { Titulo = "Get Lucky", Artista = "Daft Punk, Pharrell Williams & Nile Rodgers", DuracionSegundos = 370, Bpm = 116, Prioridad = 2, ThumbnailUrl = "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e8/43/5f/e8435ffa-b6b9-b171-40ab-4ff3959ab661/886443919266.jpg/600x600bb.jpg", AudioPreviewUrl = "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/57/a5/85/57a585aa-f1bc-7619-881b-f8a04a5541d5/mzaf_6906185026678279401.plus.aac.p.m4a" });
        cola.InsertarFinal(new PistaMusical { Titulo = "Harder Better Faster Stronger", Artista = "Daft Punk", DuracionSegundos = 225, Bpm = 123, Prioridad = 3, ThumbnailUrl = "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/fd/4a/77/fd4a77db-0ebc-d043-41a2-f32fa1bb0fb4/dj.qrikkdwj.jpg/600x600bb.jpg", AudioPreviewUrl = "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/8d/a4/4e/8da44e8f-9705-6182-686c-332714c54671/mzaf_17406318046701183138.plus.aac.p.m4a" });
        cola.InsertarFinal(new PistaMusical { Titulo = "Around the World", Artista = "Daft Punk", DuracionSegundos = 430, Bpm = 121, Prioridad = 4, ThumbnailUrl = "https://is1-ssl.mzstatic.com/image/thumb/Features115/v4/34/8d/c7/348dc71c-d75e-9baf-671a-994e9e74b018/dj.pimdxdmf.jpg/600x600bb.jpg", AudioPreviewUrl = "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/4c/a5/d7/4ca5d77c-d5d9-efeb-9838-600f5b60bde8/mzaf_7271503176898847087.plus.aac.p.m4a" });
        cola.InsertarFinal(new PistaMusical { Titulo = "Instant Crush", Artista = "Daft Punk & Julian Casablancas", DuracionSegundos = 338, Bpm = 110, Prioridad = 5, ThumbnailUrl = "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e8/43/5f/e8435ffa-b6b9-b171-40ab-4ff3959ab661/886443919266.jpg/600x600bb.jpg", AudioPreviewUrl = "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/dc/1e/c2/dc1ec21b-96a0-470c-ee89-2b09346fa847/mzaf_7827098614541126525.plus.aac.p.m4a" });
    }
}
