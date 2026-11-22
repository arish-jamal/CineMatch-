# MovieMatch

A content-based movie recommender. Search a large film catalog, hover a poster for the summary and cast, and open a title to see the films a TF-IDF model thinks are closest.

About 40,000 films are included: each one has a poster, a real plot summary, and at least 25 ratings. Cast and director names are attached wherever IMDb lists them.


## How recommendations work

`scripts/build_catalog.py` builds one document per film from:

- the plot summary
- genres (repeated so they weigh more)
- keywords
- the director
- the top-billed cast

Four TF-IDF spaces are fit separately, then combined as a weighted cosine score:

- plot and title, 0.52
- genres and keywords, 0.20
- director, 0.18
- top-billed cast, 0.10

Splitting them keeps one shared actor from overpowering the plot. Same-title duplicates are skipped so a movie does not recommend itself under a slightly different listing.

On a film page, the number on each poster is that cosine score. Under the poster, MovieMatch also names the overlap it can explain directly: shared director, shared cast, or shared genres.

## Rebuild the model

Python dependencies:

```bash
pip install -r requirements.txt
```

Download the source files (they are large and are not part of this repo):

- TMDB metadata CSV from [ada-datadruids/full_tmdb_movies_dataset](https://huggingface.co/datasets/ada-datadruids/full_tmdb_movies_dataset) (`TMDB_movie_dataset_v11.csv`)
- [IMDb non-commercial datasets](https://datasets.imdbws.com/): `title.principals.tsv.gz`, `title.crew.tsv.gz`, `name.basics.tsv.gz`

```bash
python3 scripts/build_catalog.py \
  --tmdb /path/to/TMDB_movie_dataset_v11.csv \
  --principals /path/to/title.principals.tsv.gz \
  --crew /path/to/title.crew.tsv.gz \
  --names /path/to/name.basics.tsv.gz \
  --out data
```

## Data credit

Plot summaries, posters, genres, and keywords come from The Movie Database. This product uses TMDB data but is not endorsed or certified by TMDB. Cast and director names come from IMDb's public datasets, which are offered for personal and non-commercial use.
