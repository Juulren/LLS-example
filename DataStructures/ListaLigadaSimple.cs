namespace PulseDeck.DataStructures;

public sealed class Nodo<T>(T dato)
{
    public T Dato { get; set; } = dato;
    public Nodo<T>? Siguiente { get; set; }
}

public interface IListaOperaciones<T>
{
    void InsertarInicio(T dato);
    void InsertarFinal(T dato);
    void InsertarEnPosicion(T dato, int pos);
    T EliminarInicio();
    T EliminarFinal();
    void EliminarPorId(string id);
    void ActualizarPorId(string id, T nuevoDato);
    void Invertir();
    void MoverPorId(string id, int posicion);
}
public interface IListaAlgoritmos<T>
{
    void OrdenarMergeSort(Func<T, T, int> comparador);
    ResultadoBusqueda<T> BuscarSecuencial(Func<T, bool> predicado);
}
public sealed record Hallazgo<T>(int Indice, T Dato);
public sealed record ResultadoBusqueda<T>(ListaLigadaSimple<Hallazgo<T>> Coincidencias, int SaltosTotales);

public sealed class ListaLigadaSimple<T>(Func<T, string> seleccionarId) : IListaOperaciones<T>, IListaAlgoritmos<T>
{
    public Nodo<T>? Cabeza { get; private set; }
    public int Cantidad { get; private set; }

    public void InsertarInicio(T dato) { Cabeza = new Nodo<T>(dato) { Siguiente = Cabeza }; Cantidad++; }
    public void MoverPorId(string id, int posicion)
    {
        if (posicion < 0 || posicion >= Cantidad) throw new ArgumentException("La posición debe estar entre 0 y Cantidad - 1.");
        Nodo<T>? anterior = null; var nodo = Cabeza;
        while (nodo is not null && seleccionarId(nodo.Dato) != id) { anterior = nodo; nodo = nodo.Siguiente; }
        if (nodo is null) throw new KeyNotFoundException("No existe ese ID en la cola.");
        // Reutiliza el mismo nodo: solo cambian referencias, nunca el ID ni la cantidad.
        if (anterior is null) Cabeza = nodo.Siguiente; else anterior.Siguiente = nodo.Siguiente;
        if (posicion == 0) { nodo.Siguiente = Cabeza; Cabeza = nodo; return; }
        var destino = Cabeza!;
        for (var i = 1; i < posicion; i++) destino = destino.Siguiente!;
        nodo.Siguiente = destino.Siguiente; destino.Siguiente = nodo;
    }
    public void InsertarFinal(T dato)
    {
        if (Cabeza is null) { InsertarInicio(dato); return; }
        var actual = Cabeza;
        while (actual.Siguiente is not null) actual = actual.Siguiente;
        actual.Siguiente = new Nodo<T>(dato); Cantidad++;
    }
    public void InsertarEnPosicion(T dato, int pos)
    {
        if (pos < 0 || pos > Cantidad) throw new ArgumentException("Posición fuera de rango (0 a Cantidad).");
        if (pos == 0) { InsertarInicio(dato); return; }
        var anterior = Cabeza!;
        for (var i = 1; i < pos; i++) anterior = anterior.Siguiente!;
        anterior.Siguiente = new Nodo<T>(dato) { Siguiente = anterior.Siguiente }; Cantidad++;
    }
    public T EliminarInicio()
    {
        if (Cabeza is null) throw new KeyNotFoundException("La cola está vacía.");
        var dato = Cabeza.Dato; Cabeza = Cabeza.Siguiente; Cantidad--; return dato;
    }
    public T EliminarFinal()
    {
        if (Cabeza?.Siguiente is null) return EliminarInicio();
        var actual = Cabeza;
        while (actual.Siguiente!.Siguiente is not null) actual = actual.Siguiente;
        var dato = actual.Siguiente.Dato; actual.Siguiente = null; Cantidad--; return dato;
    }
    public void EliminarPorId(string id)
    {
        Nodo<T>? anterior = null; var actual = Cabeza;
        while (actual is not null)
        {
            if (seleccionarId(actual.Dato) == id)
            {
                if (anterior is null) Cabeza = actual.Siguiente; else anterior.Siguiente = actual.Siguiente;
                Cantidad--; return;
            }
            anterior = actual; actual = actual.Siguiente;
        }
        throw new KeyNotFoundException("No existe ese ID en la cola.");
    }
    public void ActualizarPorId(string id, T nuevoDato)
    {
        var actual = Cabeza;
        while (actual is not null)
        {
            if (seleccionarId(actual.Dato) == id) { actual.Dato = nuevoDato; return; }
            actual = actual.Siguiente;
        }
        throw new KeyNotFoundException("No existe ese ID en la cola.");
    }
    public void Invertir()
    {
        Nodo<T>? anterior = null; var actual = Cabeza;
        while (actual is not null) { var siguiente = actual.Siguiente; actual.Siguiente = anterior; anterior = actual; actual = siguiente; }
        Cabeza = anterior;
    }
    public void OrdenarMergeSort(Func<T, T, int> comparador) => Cabeza = Dividir(Cabeza, comparador);
    private static Nodo<T>? Dividir(Nodo<T>? cabeza, Func<T, T, int> comparar)
    {
        if (cabeza?.Siguiente is null) return cabeza;
        var lento = cabeza; var rapido = cabeza.Siguiente;
        while (rapido?.Siguiente is not null) { lento = lento.Siguiente!; rapido = rapido.Siguiente.Siguiente; }
        var derecha = lento.Siguiente; lento.Siguiente = null;
        return Fusionar(Dividir(cabeza, comparar), Dividir(derecha, comparar), comparar);
    }
    private static Nodo<T>? Fusionar(Nodo<T>? a, Nodo<T>? b, Func<T, T, int> comparar)
    {
        Nodo<T>? cabeza = null, ultimo = null;
        while (a is not null && b is not null)
        {
            Nodo<T> elegido;
            if (comparar(a.Dato, b.Dato) <= 0) { elegido = a; a = a.Siguiente; }
            else { elegido = b; b = b.Siguiente; }
            if (ultimo is null) cabeza = elegido; else ultimo.Siguiente = elegido;
            ultimo = elegido;
        }
        if (ultimo is null) return a ?? b;
        ultimo.Siguiente = a ?? b; return cabeza;
    }
    public ResultadoBusqueda<T> BuscarSecuencial(Func<T, bool> predicado)
    {
        var resultados = new ListaLigadaSimple<Hallazgo<T>>(h => h.Indice.ToString());
        Nodo<Hallazgo<T>>? ultimo = null;
        var actual = Cabeza; var indice = 0; var saltos = 0;
        while (actual is not null)
        {
            if (predicado(actual.Dato))
            {
                // Añadir con puntero de cola local mantiene la búsqueda completa en O(n).
                var nuevo = new Nodo<Hallazgo<T>>(new Hallazgo<T>(indice, actual.Dato));
                if (ultimo is null) resultados.Cabeza = nuevo; else ultimo.Siguiente = nuevo;
                ultimo = nuevo; resultados.Cantidad++;
            }
            actual = actual.Siguiente; saltos++; indice++;
        }
        // Incluye el último salto hacia NULL; la cabeza se encuentra en cero saltos.
        return new ResultadoBusqueda<T>(resultados, saltos);
    }
}
