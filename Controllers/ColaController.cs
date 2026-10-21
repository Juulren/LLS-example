using Microsoft.AspNetCore.Mvc;
using PulseDeck.Models;
using PulseDeck.Services;

namespace PulseDeck.Controllers;

[ApiController]
[Route("api/cola")]
public sealed class ColaController(IColaMusicalService servicio) : ControllerBase
{
    private IActionResult Ejecutar(Func<object> accion)
    {
        try { return Ok(accion()); }
        catch (ArgumentException ex) { return BadRequest(new { mensaje = ex.Message }); }
        catch (KeyNotFoundException ex) { return NotFound(new { mensaje = ex.Message }); }
    }
    [HttpGet] public IActionResult Obtener() => Ejecutar(() => servicio.Obtener());
    [HttpPost("inicio")] public IActionResult Inicio(PistaSolicitud pista) => Ejecutar(() => servicio.Insertar(pista, "inicio"));
    [HttpPost("final")] public IActionResult Final(PistaSolicitud pista) => Ejecutar(() => servicio.Insertar(pista, "final"));
    [HttpPost("posicion/{pos:int}")] public IActionResult Posicion(int pos, PistaSolicitud pista) => Ejecutar(() => servicio.Insertar(pista, "posicion", pos));
    [HttpPut("{id}")] public IActionResult Actualizar(string id, PistaSolicitud pista) => Ejecutar(() => servicio.Actualizar(id, pista));
    [HttpPut("{id}/posicion/{pos:int}")] public IActionResult Mover(string id, int pos) => Ejecutar(() => servicio.Mover(id, pos));
    [HttpDelete("inicio")] public IActionResult Siguiente() => Ejecutar(() => servicio.Eliminar("inicio"));
    [HttpDelete("final")] public IActionResult QuitarFinal() => Ejecutar(() => servicio.Eliminar("final"));
    [HttpDelete("{id}")] public IActionResult Quitar(string id) => Ejecutar(() => servicio.Eliminar("id", id));
    [HttpPost("invertir")] public IActionResult Invertir() => Ejecutar(() => servicio.Invertir());
    [HttpPost("ordenar")] public IActionResult Ordenar([FromQuery] string criterio = "bpm", [FromQuery] bool asc = true) => Ejecutar(() => servicio.Ordenar(criterio, asc));
    [HttpGet("buscar")] public IActionResult Buscar([FromQuery] string q = "") => Ejecutar(() => servicio.Buscar(q.Trim()));
}
