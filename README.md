# PulseDeck

Cola musical académica: lista ligada simple propia, API .NET 8 y frontend Vanilla.

## Ejecutar

```powershell
dotnet run --urls http://localhost:5050
```

Abrir http://localhost:5050. No requiere paquetes npm, base de datos ni claves.
El Singleton conserva la sesión en memoria y se reinicia con cinco canciones de Daft Punk.
La primera pista se activa con Reproducir o Siguiente; no hay autoplay al cargar.

## Estructura

- `Program.cs`, `Models/PistaMusical.cs`, `DataStructures/ListaLigadaSimple.cs`, `Services/ColaMusicalService.cs`, `Controllers/ColaController.cs`: backend.
- El servicio incluye cinco pistas reales consultadas en iTunes.
- `wwwroot/index.html`, `styles.css`, `app.js`: interfaz servida por la API.

## Operaciones

`GET /api/cola`, `POST /api/cola/inicio`, `POST /api/cola/final`, `POST /api/cola/posicion/{pos}`,
`PUT /api/cola/{id}`, `DELETE /api/cola/inicio`, `DELETE /api/cola/final`, `DELETE /api/cola/{id}`,
`POST /api/cola/invertir`, `POST /api/cola/ordenar?criterio=bpm&asc=true`, `GET /api/cola/buscar?q=texto`.

POST/PUT de pistas reciben `titulo`, `artista`, `duracionSegundos`, `bpm`, `prioridad`, `thumbnailUrl` y `audioPreviewUrl`.
IDs generados en servidor. Índices desde 0. Criterios: `bpm`, `duracion`, `prioridad`.
La búsqueda devuelve todas las coincidencias con índice/saltos desde Cabeza y saltos totales, incluido el salto final a NULL (n saltos para n nodos).
Merge Sort es estable y modifica enlaces; la búsqueda completa es O(n).
Los DTO se capturan en cadenas independientes bajo bloqueo antes de serializar para evitar carreras con escrituras.
No se usan colecciones nativas ni LINQ para almacenar, buscar u ordenar canciones en C#.

## Audio y accesibilidad

Previews y portadas dependen de iTunes y de la red; el ingreso manual funciona sin ese servicio.
Las URLs de los cinco previews devolvieron HTTP 200 y `Access-Control-Allow-Origin: *` al implementarse.
BPM y prioridad se editan manualmente; iTunes no proporciona BPM y los valores iniciales son orientativos.
La duración indicada es la canción completa; el reproductor muestra la duración real del preview.
La carcasa acepta ratón, arrastre y flechas de teclado; Home restablece el ángulo.
Con movimiento reducido se detienen inclinación, giro y animación de barras.

El fondo usa el shader Scanner de React Bits, adaptado a WebGL2 sin React en
`wwwroot/scanner.js`, con naranja/violeta, menor brillo y una capa oscura para
separarlo de los paneles. Se pausa cuando la pestaña está oculta y queda estático
con movimiento reducido. Sin WebGL2 permanece un fondo ambiental CSS.
La atribución y licencia original están en `THIRD-PARTY-NOTICES.md`.
El buscador de iTunes está encima de la cola; seleccionar una canción revela las
acciones de inserción. Filtros despliega el formulario manual y permite ajustar
los datos importados. Descartar o completar una inserción restablece el buscador.

Arrastra el asa ⠿ de una tarjeta para cambiar su posición; una línea naranja indica
el destino y la página se desplaza al acercarse a sus extremos. También funciona
con pantalla táctil y con las flechas arriba/abajo al enfocar el asa. Al soltar,
`PUT /api/cola/{id}/posicion/{pos}` mueve el mismo nodo por referencias bajo bloqueo
en O(n), conserva ID y cantidad, y actualiza índices, enlaces y telemetría.
`pos` indica el índice final desde 0 hasta Cantidad - 1. Con una búsqueda activa,
el destino se refiere a la posición real de la canción en la cola completa.

## Verificación reproducible

```powershell
dotnet build
node --check wwwroot/app.js
# En una terminal, iniciar una instancia separada para pruebas:
dotnet run --no-build --urls http://localhost:5051
# En otra terminal:
./scripts/Test-Api.ps1
```

La prueba altera la cola de la instancia 5051. Incluye validación de enlaces, cola vacía,
un nodo, posiciones límite, conservación de IDs, inversión doble, búsqueda y estabilidad
de Merge Sort para los tres criterios en ambos sentidos. Reiniciar restaura las pistas.
