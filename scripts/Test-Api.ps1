param([string]$BaseUrl = 'http://localhost:5051')
$ErrorActionPreference = 'Stop'
# Ejecutar contra una instancia de prueba: dotnet run --no-build --urls http://localhost:5051
# Esta prueba modifica exclusivamente la cola en memoria de esa instancia.
function Api($method, $path, $data = $null) {
    $argsApi = @{ Method=$method; Uri="$BaseUrl/api/cola$path" }
    if ($null -ne $data) { $argsApi.ContentType='application/json'; $argsApi.Body=($data | ConvertTo-Json -Compress) }
    Invoke-RestMethod @argsApi
}
function Assert($condition, $message) { if (!$condition) { throw "FAIL: $message" }; Write-Output "PASS: $message" }
function Status($method, $path, $expected, $data = $null) {
    try { $null = Api $method $path $data; throw 'Expected failure' }
    catch { if (!$_.Exception.Response -or [int]$_.Exception.Response.StatusCode -ne $expected) { throw }; Write-Output "PASS: $method $path -> $expected" }
}
function CheckLinks($state) {
    Assert (@($state.nodos).Count -eq $state.cantidad) 'cantidad coincide con recorrido'
    for ($i=0; $i -lt $state.cantidad; $i++) {
        $next = if ($i -eq $state.cantidad-1) { 'NULL' } else { $state.nodos[$i+1].idActual }
        if ($state.nodos[$i].indice -ne $i -or $state.nodos[$i].idSiguiente -ne $next) { throw 'FAIL: cadena de enlaces' }
    }
    Write-Output 'PASS: índices y enlaces hasta NULL'
}
$initial=Api GET ''; Assert ($initial.cantidad -eq 5 -and $null -eq $initial.pistaActual) 'cinco canciones iniciales y reproductor vacío'
CheckLinks $initial
$ids = ($initial.nodos.idActual -join ',')
$null=Api POST '/invertir'; $state=Api POST '/invertir'; Assert (($state.nodos.idActual -join ',') -eq $ids) 'doble inversión restaura IDs y orden'
$search=Api GET '/buscar?q=DAFT'; Assert (@($search.coincidencias).Count -eq 5 -and $search.saltosTotales -eq 5 -and $search.coincidencias[0].saltos -eq 0 -and $search.coincidencias[4].saltos -eq 4) 'búsqueda insensible a mayúsculas y saltos exactos'
foreach ($n in $initial.nodos) { $null=Api DELETE "/$($n.idActual)" }
Status DELETE '/inicio' 404; Status DELETE '/final' 404; Status DELETE '/inexistente' 404
$empty=Api GET '/buscar?q=x'; Assert ($empty.saltosTotales -eq 0) 'búsqueda vacía sin saltos'
$p=@{ titulo='A'; artista='Test'; duracionSegundos=100; bpm=120; prioridad=3; thumbnailUrl=''; audioPreviewUrl='' }
Status POST '/posicion/-1' 400 $p; Status POST '/posicion/1' 400 $p
$state=Api POST '/posicion/0' $p; $id=$state.nodos[0].idActual
$p.titulo='A editada'; $state=Api PUT "/$id" $p; Assert ($state.nodos[0].idActual -eq $id -and $state.nodos[0].pista.titulo -eq 'A editada') 'actualización conserva ID'
Status PUT '/inexistente' 404 $p
$state=Api DELETE '/final'; Assert ($state.cantidad -eq 0 -and $null -eq $state.pistaActual) 'eliminar único final no cambia reproductor'
$null=Api POST '/final' $p; $state=Api DELETE '/inicio'; Assert ($state.cantidad -eq 0 -and $state.pistaActual.titulo -eq 'A editada') 'despachar único nodo activa reproductor'
$p.titulo='B'; $null=Api POST '/inicio' $p; $p.titulo='A'; $null=Api POST '/inicio' $p; $p.titulo='C'; $null=Api POST '/posicion/2' $p; $p.titulo='Intermedia'; $null=Api POST '/posicion/1' $p
$state=Api GET ''; Assert (($state.nodos.pista.titulo -join ',') -eq 'A,Intermedia,B,C') 'inserciones inicio, final y posición intermedia'
foreach ($criterion in @('bpm','duracion','prioridad')) {
    foreach ($direction in @('true','false')) {
        $state=Api POST "/ordenar?criterio=$criterion&asc=$direction"
        Assert (($state.nodos.pista.titulo -join ',') -eq 'A,Intermedia,B,C') "Merge Sort estable $criterion $direction"
    }
}
$id=$state.nodos[1].idActual; $state=Api DELETE "/$id"; Assert (($state.nodos.pista.titulo -join ',') -eq 'A,B,C') 'eliminación intermedia puentea nodo'
$id=$state.nodos[2].idActual; $p.titulo='C'; $p.bpm=80; $p.duracionSegundos=50; $p.prioridad=1; $null=Api PUT "/$id" $p
foreach ($criterion in @('bpm','duracion','prioridad')) {
    $state=Api POST "/ordenar?criterio=$criterion&asc=true"; Assert ($state.nodos[0].pista.titulo -eq 'C') "orden ascendente $criterion"
    $state=Api POST "/ordenar?criterio=$criterion&asc=false"; Assert ($state.nodos[2].pista.titulo -eq 'C') "orden descendente $criterion"
    CheckLinks $state
}
Status POST '/ordenar?criterio=foo' 400
$p.titulo=' '; Status POST '/final' 400 $p; $p.titulo='X'; $p.bpm=0; Status POST '/final' 400 $p; $p.bpm=100; $p.prioridad=6; Status POST '/final' 400 $p
$p.prioridad=1; $p.audioPreviewUrl='javascript:alert(1)'; Status POST '/final' 400 $p
$search=Api GET '/buscar?q=sin-coincidencias'; Assert (@($search.coincidencias).Count -eq 0 -and $search.saltosTotales -eq 3) 'búsqueda sin coincidencias recorre hasta NULL'
$state=Api GET ''; $moveId=$state.nodos[0].idActual; $before=($state.nodos.idActual -join ','); $playingId=$state.pistaActual.id
$state=Api PUT "/$moveId/posicion/2"; Assert ($state.nodos[2].idActual -eq $moveId -and $state.cantidad -eq 3 -and $state.pistaActual.id -eq $playingId) 'mover cabeza al final conserva ID, cantidad y reproducción'; CheckLinks $state
$state=Api PUT "/$moveId/posicion/0"; Assert (($state.nodos.idActual -join ',') -eq $before) 'mover final a cabeza restaura orden'; CheckLinks $state
$state=Api PUT "/$moveId/posicion/1"; Assert ($state.nodos[1].idActual -eq $moveId) 'mover a posición intermedia'; CheckLinks $state
$same=($state.nodos.idActual -join ','); $state=Api PUT "/$moveId/posicion/1"; Assert (($state.nodos.idActual -join ',') -eq $same) 'mover a misma posición conserva cadena'
Status PUT "/$moveId/posicion/-1" 400; Status PUT "/$moveId/posicion/3" 400; Status PUT '/inexistente/posicion/0' 404
$state=Api GET ''; Assert (($state.nodos.idActual -join ',') -eq $same) 'movimientos inválidos no alteran cola'
foreach($node in $state.nodos) { if($node.idActual -ne $moveId) { $null=Api DELETE "/$($node.idActual)" } }
$state=Api PUT "/$moveId/posicion/0"; Assert ($state.cantidad -eq 1 -and $state.nodos[0].idSiguiente -eq 'NULL') 'mover único nodo conserva NULL'
$null=Api DELETE "/$moveId"; Status PUT "/$moveId/posicion/0" 400
Write-Output 'Todas las verificaciones de API completadas.'
