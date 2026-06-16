# Pocket Ledger

App PWA offline para administrar finanzas personales por mes, quincena, semana o mes completo.

## Abrir

Puedes abrir `index.html` directamente en el navegador para una prueba rapida. Para probar instalacion PWA, modo offline y service worker, sirve la carpeta con un servidor local.

## Incluye

- Dashboard mensual con disponible, gastos, ahorro, estado financiero y grafica por categoria.
- Selector de mes, anio y periodo configurable: quincenal, semanal o mensual.
- Registro rapido de ingresos y gastos.
- Movimientos por fecha, categoria, tipo, estado y periodo.
- Categorias editables con color e icono corto.
- Pagos fijos editables, marcables como pagados o pendientes.
- Presupuesto mensual por categoria con estado visual.
- Metas de ahorro con avance, monto faltante y aportacion sugerida.
- Deudas con saldo pendiente, pagos parciales e historial.
- Calendario financiero mensual.
- Reportes con mayores gastos, promedio diario y proyeccion de cierre.
- Simulador financiero.
- Herramienta "Puedo comprar esto?"
- Deteccion de gasto hormiga con limite configurable.
- Exportar respaldo completo a Excel `.xlsx`.
- Importar respaldo completo desde Excel `.xlsx`.
- Importar movimientos desde el Excel anterior con hoja `GASTOS`.
- Exportar reporte mensual a PDF usando impresion del navegador.
- Proteccion opcional con PIN local.
- Guardado persistente en IndexedDB con respaldo a localStorage.
- Manifest y service worker para uso offline.

## Desarrollo

Instala dependencias y ejecuta:

```bash
npm run dev
```

Si pruebas cambios de PWA, usa una ventana normal del navegador y recarga. El service worker usa cach de version y limpia versiones anteriores al activarse.

## Publicar en GitHub Pages

El proyecto esta configurado para un repositorio llamado `pocket-ledger`.

1. Crea un repositorio en GitHub llamado `pocket-ledger`.
2. En la carpeta del proyecto ejecuta:

```bash
git init
git add .
git commit -m "Publicar Pocket Ledger PWA"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/pocket-ledger.git
git push -u origin main
```

3. En GitHub abre `Settings > Pages`.
4. En `Build and deployment`, selecciona `Source: GitHub Actions`.
5. Ve a `Actions` y espera a que termine `Deploy Pocket Ledger to GitHub Pages`.
6. La app quedara disponible en:

```text
https://TU_USUARIO.github.io/pocket-ledger/
```

Para probar antes de publicar:

```bash
npm run build
npm run preview
```
