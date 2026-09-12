"""Helpers for YouTube Music nested JSON."""
from __future__ import annotations

import re
from typing import Any, Iterator

from app.models import ArtistRef, Card, Thumbnail, Track

DURATION_RE = re.compile(r"^(\d+:)?\d{1,2}:\d{2}$")


def walk(obj: Any) -> Iterator[Any]:
    if isinstance(obj, dict):
        yield obj
        for v in obj.values():
            yield from walk(v)
    elif isinstance(obj, list):
        for item in obj:
            yield from walk(item)


def runs_text(node: Any) -> str:
    if node is None:
        return ""
    if isinstance(node, str):
        return node
    if isinstance(node, dict):
        if "text" in node and isinstance(node["text"], str) and "runs" not in node:
            return node["text"]
        runs = node.get("runs")
        if isinstance(runs, list):
            return "".join(str(r.get("text", "")) for r in runs if isinstance(r, dict))
        if "simpleText" in node:
            return str(node["simpleText"])
    if isinstance(node, list):
        return "".join(runs_text(x) for x in node)
    return ""


def best_thumbnails(node: Any) -> list[Thumbnail]:
    thumbs: list[dict] = []
    if isinstance(node, list):
        thumbs = [t for t in node if isinstance(t, dict) and t.get("url")]
    elif isinstance(node, dict):
        inner = node.get("thumbnails") or node.get("sources")
        if isinstance(inner, list):
            thumbs = [t for t in inner if isinstance(t, dict) and t.get("url")]
        elif node.get("url"):
            thumbs = [node]
    out: list[Thumbnail] = []
    for t in thumbs:
        url = t.get("url", "")
        if url.startswith("//"):
            url = "https:" + url
        out.append(
            Thumbnail(url=url, width=t.get("width"), height=t.get("height"))
        )
    return out


def find_thumbnails(obj: Any) -> list[Thumbnail]:
    for node in walk(obj):
        if not isinstance(node, dict):
            continue
        if "thumbnails" in node and isinstance(node["thumbnails"], list):
            parsed = best_thumbnails(node["thumbnails"])
            if parsed:
                return parsed
        renderer = node.get("musicThumbnailRenderer") or node.get("croppedSquareThumbnailRenderer")
        if renderer:
            parsed = find_thumbnails(renderer)
            if parsed:
                return parsed
    return []


def duration_to_seconds(text: str | None) -> int | None:
    if not text:
        return None
    parts = text.strip().split(":")
    if not all(p.isdigit() for p in parts) or len(parts) not in (2, 3):
        return None
    values = [int(p) for p in parts]
    if len(values) == 2:
        return values[0] * 60 + values[1]
    return values[0] * 3600 + values[1] * 60 + values[2]


def _watch_video_id(node: Any) -> str | None:
    for item in walk(node):
        if not isinstance(item, dict):
            continue
        we = item.get("watchEndpoint") or item.get("watchPlaylistEndpoint")
        if isinstance(we, dict) and we.get("videoId"):
            return we["videoId"]
        pid = item.get("playlistItemData")
        if isinstance(pid, dict) and pid.get("videoId"):
            return pid["videoId"]
        if item.get("videoId") and isinstance(item["videoId"], str) and len(item["videoId"]) == 11:
            return item["videoId"]
    return None


def _browse_id(node: Any) -> tuple[str | None, str | None]:
    """Return (browseId, pageType)."""
    for item in walk(node):
        if not isinstance(item, dict):
            continue
        be = item.get("browseEndpoint")
        if not isinstance(be, dict):
            continue
        bid = be.get("browseId")
        page = None
        cfg = be.get("browseEndpointContextSupportedConfigs") or {}
        music = cfg.get("browseEndpointContextMusicConfig") or {}
        page = music.get("pageType")
        if bid:
            return bid, page
    return None, None


def _playlist_id(node: Any) -> str | None:
    for item in walk(node):
        if not isinstance(item, dict):
            continue
        we = item.get("watchEndpoint") or item.get("watchPlaylistEndpoint")
        if isinstance(we, dict) and we.get("playlistId"):
            return we["playlistId"]
        be = item.get("browseEndpoint")
        if isinstance(be, dict):
            bid = be.get("browseId", "")
            if bid.startswith("VL"):
                return bid[2:]
            if bid.startswith(("PL", "OL", "RD")):
                return bid
        if item.get("playlistId"):
            return item["playlistId"]
    return None


def _artists_from_runs(runs: Any) -> list[ArtistRef]:
    if not isinstance(runs, list):
        return []
    artists: list[ArtistRef] = []
    for run in runs:
        if not isinstance(run, dict):
            continue
        text = run.get("text", "")
        if text in (" • ", " •", "• ", "•", ", ", ",", " & "):
            continue
        if DURATION_RE.match(text.strip()):
            continue
        bid, page = _browse_id(run)
        if page == "MUSIC_PAGE_TYPE_ARTIST" or (bid and bid.startswith("UC")):
            artists.append(ArtistRef(name=text, id=bid))
        elif "browseEndpoint" in str(run.get("navigationEndpoint", {})) and bid and bid.startswith("UC"):
            artists.append(ArtistRef(name=text, id=bid))
    if not artists:
        # subtitle like "Artist • Album • 3:21"
        joined = "".join(r.get("text", "") for r in runs if isinstance(r, dict))
        first = joined.split("•")[0].strip()
        if first and not DURATION_RE.match(first):
            artists.append(ArtistRef(name=first, id=None))
    return artists


def parse_flex_columns(renderer: dict) -> tuple[str, list[ArtistRef], str | None, str | None]:
    columns = renderer.get("flexColumns") or []
    title = ""
    artists: list[ArtistRef] = []
    album = None
    duration = None
    for i, col in enumerate(columns):
        inner = (
            col.get("musicResponsiveListItemFlexColumnRenderer")
            or col.get("musicResponsiveListItemFixedColumnRenderer")
            or col
        )
        text_node = inner.get("text") or {}
        runs = text_node.get("runs") if isinstance(text_node, dict) else None
        text = runs_text(text_node)
        if i == 0:
            title = text
            continue
        if DURATION_RE.match(text.strip()):
            duration = text.strip()
            continue
        if isinstance(runs, list):
            for run in runs:
                if not isinstance(run, dict):
                    continue
                t = run.get("text", "")
                if DURATION_RE.match(t.strip()):
                    duration = t.strip()
                    continue
                bid, page = _browse_id(run)
                if page == "MUSIC_PAGE_TYPE_ALBUM":
                    album = t
                elif page == "MUSIC_PAGE_TYPE_ARTIST" or (bid and str(bid).startswith("UC")):
                    artists.append(ArtistRef(name=t, id=bid))
        if not artists and text:
            parts = [p.strip() for p in text.split("•")]
            if parts:
                artists.append(ArtistRef(name=parts[0], id=None))
            if len(parts) > 1 and not DURATION_RE.match(parts[1]):
                album = album or parts[1]
    fixed = renderer.get("fixedColumns") or []
    for col in fixed:
        inner = col.get("musicResponsiveListItemFixedColumnRenderer") or col
        t = runs_text(inner.get("text"))
        if DURATION_RE.match(t.strip()):
            duration = t.strip()
    return title, artists, album, duration


def track_from_responsive(renderer: dict) -> Track | None:
    video_id = renderer.get("playlistItemData", {}).get("videoId") or _watch_video_id(renderer)
    title, artists, album, duration = parse_flex_columns(renderer)
    if not video_id or not title:
        return None
    badges = renderer.get("badges") or []
    explicit = "EXPLICIT" in str(badges).upper()
    artist_name = ", ".join(a.name for a in artists) if artists else "Unknown"
    album_id = None
    bid, page = _browse_id(renderer.get("flexColumns", []))
    if page == "MUSIC_PAGE_TYPE_ALBUM":
        album_id = bid
    return Track(
        videoId=video_id,
        title=title,
        artist=artist_name,
        artists=artists,
        album=album,
        albumId=album_id,
        thumbnails=find_thumbnails(renderer),
        duration=duration,
        durationSeconds=duration_to_seconds(duration),
        explicit=explicit,
        type="song",
    )


def track_from_playlist_panel(renderer: dict) -> Track | None:
    video_id = renderer.get("videoId") or _watch_video_id(renderer)
    title = runs_text(renderer.get("title"))
    if not video_id or not title:
        return None
    long_by = runs_text(renderer.get("longBylineText") or renderer.get("shortBylineText"))
    artists = _artists_from_runs((renderer.get("longBylineText") or {}).get("runs"))
    if not artists and long_by:
        artists = [ArtistRef(name=long_by.split("•")[0].strip())]
    duration = runs_text(renderer.get("lengthText"))
    return Track(
        videoId=video_id,
        title=title,
        artist=", ".join(a.name for a in artists) if artists else (long_by.split("•")[0].strip() if long_by else "Unknown"),
        artists=artists,
        thumbnails=find_thumbnails(renderer),
        duration=duration or None,
        durationSeconds=duration_to_seconds(duration),
        type="song",
    )


def card_from_two_row(renderer: dict) -> Card | None:
    title = runs_text(renderer.get("title"))
    subtitle = runs_text(renderer.get("subtitle"))
    bid, page = _browse_id(renderer)
    video_id = _watch_video_id(renderer)
    playlist_id = _playlist_id(renderer)
    if not title:
        return None
    ctype: Card.__annotations__  # noqa
    kind: str = "album"
    if page == "MUSIC_PAGE_TYPE_ARTIST" or (bid and bid.startswith("UC")):
        kind = "artist"
    elif page == "MUSIC_PAGE_TYPE_PLAYLIST" or (playlist_id and not (bid or "").startswith("MPRE")):
        kind = "playlist"
    elif page == "MUSIC_PAGE_TYPE_ALBUM" or (bid and bid.startswith("MPRE")):
        kind = "album"
    elif video_id:
        kind = "song"
    ident = bid or playlist_id or video_id or title
    return Card(
        id=ident,
        title=title,
        subtitle=subtitle or None,
        thumbnails=find_thumbnails(renderer),
        type=kind,  # type: ignore[arg-type]
        videoId=video_id,
        playlistId=playlist_id,
        browseId=bid,
    )


def card_from_responsive(renderer: dict) -> Card | None:
    title, artists, album, duration = parse_flex_columns(renderer)
    bid, page = _browse_id(renderer)
    video_id = _watch_video_id(renderer)
    playlist_id = _playlist_id(renderer)
    if not title:
        return None
    kind = "song"
    if page == "MUSIC_PAGE_TYPE_ARTIST" or (bid and str(bid).startswith("UC") and not video_id):
        kind = "artist"
    elif page == "MUSIC_PAGE_TYPE_ALBUM":
        kind = "album"
    elif page == "MUSIC_PAGE_TYPE_PLAYLIST":
        kind = "playlist"
    ident = bid or playlist_id or video_id or title
    subtitle = ", ".join(a.name for a in artists) if artists else album
    return Card(
        id=ident,
        title=title,
        subtitle=subtitle,
        thumbnails=find_thumbnails(renderer),
        type=kind,  # type: ignore[arg-type]
        videoId=video_id,
        playlistId=playlist_id,
        browseId=bid,
    )


def extract_tracks(data: Any, limit: int = 200) -> list[Track]:
    tracks: list[Track] = []
    seen: set[str] = set()
    for node in walk(data):
        if not isinstance(node, dict):
            continue
        parsed: Track | None = None
        if "musicResponsiveListItemRenderer" in node:
            parsed = track_from_responsive(node["musicResponsiveListItemRenderer"])
        elif "playlistPanelVideoRenderer" in node:
            parsed = track_from_playlist_panel(node["playlistPanelVideoRenderer"])
        elif "musicTwoRowItemRenderer" in node:
            card = card_from_two_row(node["musicTwoRowItemRenderer"])
            if card and card.videoId:
                parsed = Track(
                    videoId=card.videoId,
                    title=card.title,
                    artist=card.subtitle or "Unknown",
                    thumbnails=card.thumbnails,
                    type="song",
                )
        if parsed and parsed.videoId not in seen:
            seen.add(parsed.videoId)
            tracks.append(parsed)
            if len(tracks) >= limit:
                break
    return tracks


def extract_cards(data: Any, prefer: str | None = None, limit: int = 100) -> list[Card]:
    cards: list[Card] = []
    seen: set[str] = set()
    for node in walk(data):
        if not isinstance(node, dict):
            continue
        parsed: Card | None = None
        if "musicTwoRowItemRenderer" in node:
            parsed = card_from_two_row(node["musicTwoRowItemRenderer"])
        elif "musicResponsiveListItemRenderer" in node:
            parsed = card_from_responsive(node["musicResponsiveListItemRenderer"])
        if not parsed:
            continue
        if prefer and parsed.type != prefer:
            continue
        key = parsed.id
        if key in seen:
            continue
        seen.add(key)
        cards.append(parsed)
        if len(cards) >= limit:
            break
    return cards


def shelf_contents(section: dict) -> list[Any]:
    for key in (
        "musicShelfRenderer",
        "musicCarouselShelfRenderer",
        "musicPlaylistShelfRenderer",
        "musicCardShelfRenderer",
        "gridRenderer",
    ):
        if key in section:
            block = section[key]
            title = runs_text(block.get("header") or block.get("title"))
            contents = block.get("contents") or block.get("items") or []
            return [{"title": title, "contents": contents, "raw": block}]
    return []


def extract_shelves(data: Any) -> list[tuple[str, Any]]:
    shelves: list[tuple[str, Any]] = []
    for node in walk(data):
        if not isinstance(node, dict):
            continue
        for key in (
            "musicShelfRenderer",
            "musicCarouselShelfRenderer",
            "musicPlaylistShelfRenderer",
        ):
            if key not in node:
                continue
            block = node[key]
            header = block.get("header") or {}
            title = (
                runs_text(block.get("title"))
                or runs_text(header.get("musicCarouselShelfBasicHeaderRenderer", {}).get("title"))
                or runs_text(header.get("musicShelfHeaderRenderer", {}).get("title"))
                or "More"
            )
            shelves.append((title, block))
    # de-dupe by identity of first item title + shelf title
    unique = []
    seen = set()
    for title, block in shelves:
        marker = title + str(id(block))
        if marker in seen:
            continue
        seen.add(marker)
        unique.append((title, block))
    return unique


def header_text(data: Any) -> dict[str, Any]:
    name = ""
    description = None
    thumbs: list[Thumbnail] = []
    subtitle = None
    year = None

    # 1. Primary: Extract title & high-res artwork from microformat if available
    micro = (data.get("microformat") or {}).get("microformatDataRenderer") or {}
    if micro:
        name = micro.get("title") or ""
        description = micro.get("description")
        raw_thumbs = (micro.get("thumbnail") or {}).get("thumbnails") or []
        for t in raw_thumbs:
            if isinstance(t, dict) and t.get("url"):
                thumbs.append(Thumbnail(url=t["url"], width=t.get("width"), height=t.get("height")))

    # 2. Walk all header renderers in response
    for node in walk(data):
        if not isinstance(node, dict):
            continue
        for key in (
            "musicResponsiveHeaderRenderer",
            "musicImmersiveHeaderRenderer",
            "musicDetailHeaderRenderer",
            "musicVisualHeaderRenderer",
            "musicEditablePlaylistDetailHeaderRenderer",
            "musicHeaderRenderer",
        ):
            if key in node:
                h = node[key]
                if key == "musicEditablePlaylistDetailHeaderRenderer":
                    h = (
                        h.get("header", {}).get("musicResponsiveHeaderRenderer")
                        or h.get("header", {}).get("musicDetailHeaderRenderer")
                        or h
                    )
                t_cand = runs_text(h.get("title"))
                if t_cand:
                    name = t_cand
                d_cand = runs_text(h.get("description") or h.get("descriptionText"))
                if d_cand:
                    description = d_cand
                s_cand = runs_text(h.get("subtitle"))
                if s_cand:
                    subtitle = s_cand
                parsed_thumbs = find_thumbnails(h)
                if parsed_thumbs:
                    thumbs = parsed_thumbs
                second = h.get("secondSubtitle")
                st = runs_text(second)
                if st:
                    for part in st.split("•"):
                        p = part.strip()
                        if p.isdigit() and len(p) == 4:
                            year = p

    return {
        "name": name,
        "description": description,
        "thumbnails": thumbs,
        "subtitle": subtitle,
        "year": year,
    }
