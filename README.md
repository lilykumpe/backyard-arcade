# Backyard Arcade

[Play Backyard Arcade](https://lilykumpe.github.io/backyard-arcade/). Practise identification from photographs with spaced review, typed answers, iNaturalist imports and offline study sets. The starter pack covers six backyard moth families.

## Try it on a Mac

From Terminal in the project folder:

```sh
python3 preview.py
```

Open **http://127.0.0.1:8765/** in a normal browser window. Keep using that address, port and browser profile to retain progress. Ctrl-C stops the local server.

1. Choose **Study order** on the main toolbar (for example **Coleoptera (beetles)**), then choose **Practise** (family, genus, scientific species name, or the observation’s common name) and **Answer method**. In typed mode, submit a non-empty answer before revealing.
2. Open **Sets & filters** to choose class, family, and research grade or all grades. A rank needs two distinct answers to be playable. Filtering to a single family selects genus if there are multiple genera, or another available target. The preview counts matching photographs and answers. Missing names are excluded from that target. Select **Start / resume set** to apply. The sets menu keeps previous configurations, each with its own progress.
3. To use another iNaturalist export, choose the CSV in the same panel. Include `image_url`, `quality_grade`, the `taxon_*_name` hierarchy, `scientific_name` and `common_name` for the modes you want. The file is parsed locally. The browser retains the study fields in IndexedDB. External photos load from their source when studied or saved for offline use.
4. After an answer, inspect its taxonomy, scientific and common names, and observation link. Photo credits are available at the source. In spoken recall you can reveal or use **Show choices**. An incorrect answer offers **Next** and returns on the Again interval. If the guess matches another answer in the set, both photographs appear side by side. For a correct answer or a self-assessed reveal, choose **Again**, **Hard**, **Good** or **Easy**.
5. **End & review** opens a scrollable sheet of the latest difficulty for each answer in this configuration, including mistyped answers, mix-ups, assisted guesses, and Hard or Again ratings. Resume to return to the same card. The same browser remembers your active set the next day.
6. Choose **Keep this set offline** and wait for the photograph count to finish before disconnecting. External source links need a connection. Clearing site data removes sets and progress.

## Load public iNaturalist observations

Under **Sets & filters → Load from iNaturalist**, enter a username, user ID, public project slug or project ID. Choose the quality grade and the number of recent observations to fetch. The default is the latest 200 research-grade observations with photos. After loading, select a practice target and **Start / resume set**. Common-name practice uses iNaturalist’s preferred English names where available. Species common-name practice uses observations identified to species or finer. Family and genus common-name targets use names at those ranks and require two distinct answers. A fetched collection is saved in this browser. Use **Keep this set offline** to download its photographs.

## Draw more examples

**New photo set** opens the full project export on the Mac preview. Choose a family such as Geometridae and practise genus or species, or choose the order Coleoptera and practise family. Pick **Photos per draw**, then **Draw new set**. Repeat to take another batch from the same filters. Each draw takes photographs across the eligible answers. The final batch can be smaller. If only one taxon has fresh photographs left, the draw includes an earlier example from a different taxon for comparison. The controls say when the pool is exhausted and a new cycle will begin. For collections containing the starter photographs, the first cycle reserves those photos for the starter pack.

Each draw has its own saved photographs and review progress. Use **Saved study sets** and **Start / resume set** to return to a previous one. To practise every matching record, choose **All matching photos** in the saved sets menu, then start the set. The Pages build includes the 36-photo starter pack. Larger sources come from the iNaturalist API, browser CSV imports or the Mac preview’s local copy of the project export.

## Tomorrow's playtest

Today, rate a family **Good**. Tomorrow, open the same address, say the family before revealing it, and see whether you recognised it in a different genus. The original family set rotates through six photographs per family. Finer targets with just one eligible image reuse it. **Practise another photograph** allows early review once nothing is due.

The scheduler stores one record per family within the set. Equally due families are shuffled each day. Choices favour previous mix-ups and other families from the same superfamily. The completion screen reports how many unaided reviews you rated Good or Easy that day. Again returns in two minutes and Hard in ten. The first unaided Good is due the next local calendar day and Easy in three days. Subsequent Good and Easy intervals grow. Using choices caps either interval at tomorrow. A confusion brings both families back after two intervening grades or two minutes, whichever comes first. Unaided ratings are self-assessments. The browser stores assisted attempts, correct choices, family confusions and photo positions locally.

## Set and site files

The current local test export, `observations-819165.csv`, contains 3,281 observations. The six most represented moth families with photo URLs are Geometridae (347), Erebidae (302), Crambidae (229), Oecophoridae (131), Noctuidae (113) and Pyralidae (100). Each contributes six reviewed photographs from different genera and different research-grade observations. Photo-specific attribution and licence codes came from the matching public iNaturalist photo IDs. The bundled copies are resized JPEGs with embedded metadata removed.

`study/set.json` contains the set ID, target rank, name mode, answer labels, photographs and source credits. The default target is scientific family name. The other modes group the photographs by their selected answer. The static build takes only the listed site files and the 36 manifest photographs. No CSV, coordinates or private locality fields are copied. To inspect a Pages-compatible build locally, pass a **new** directory to `python3 preview.py --build <directory>`. GitHub Pages deploys the allowlisted build generated from main.

Future work includes portable packs with progress for iCloud Drive, and a Specimen Snake mode with a persistent **HUNT** cue and larger photos. Seen Before? and Sheet Invaders are excluded from the study prototype.
