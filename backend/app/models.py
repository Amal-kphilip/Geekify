from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field


class Thumbnail(BaseModel):
    url: str
    width: Optional[int] = None
    height: Optional[int] = None


class ArtistRef(BaseModel):
    name: str
    id: Optional[str] = None


class Track(BaseModel):
    videoId: str
    title: str
    artist: str
    artists: list[ArtistRef] = Field(default_factory=list)
    album: Optional[str] = None
    albumId: Optional[str] = None
    thumbnails: list[Thumbnail] = Field(default_factory=list)
    duration: Optional[str] = None
    durationSeconds: Optional[int] = None
    explicit: bool = False
    type: Literal["song", "video"] = "song"


class Card(BaseModel):
    id: str
    title: str
    subtitle: Optional[str] = None
    thumbnails: list[Thumbnail] = Field(default_factory=list)
    type: Literal["album", "playlist", "artist", "song", "station"] = "album"
    videoId: Optional[str] = None
    playlistId: Optional[str] = None
    browseId: Optional[str] = None


class Shelf(BaseModel):
    title: str
    items: list[Card | Track] = Field(default_factory=list)


class SearchResponse(BaseModel):
    query: str
    songs: list[Track] = Field(default_factory=list)
    albums: list[Card] = Field(default_factory=list)
    artists: list[Card] = Field(default_factory=list)
    playlists: list[Card] = Field(default_factory=list)
    shelves: list[Shelf] = Field(default_factory=list)


class HomeResponse(BaseModel):
    shelves: list[Shelf]


class ArtistPage(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    thumbnails: list[Thumbnail] = Field(default_factory=list)
    songs: list[Track] = Field(default_factory=list)
    albums: list[Card] = Field(default_factory=list)
    singles: list[Card] = Field(default_factory=list)
    related: list[Card] = Field(default_factory=list)


class CollectionPage(BaseModel):
    id: str
    title: str
    subtitle: Optional[str] = None
    description: Optional[str] = None
    type: Literal["album", "playlist"] = "playlist"
    year: Optional[str] = None
    thumbnails: list[Thumbnail] = Field(default_factory=list)
    tracks: list[Track] = Field(default_factory=list)
    artist: Optional[str] = None
    artistId: Optional[str] = None


class PlayabilityErrorBody(BaseModel):
    error: str
    status: str
    reason: Optional[str] = None
    videoId: str
