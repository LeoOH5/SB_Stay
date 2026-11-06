"use client";
// T21 여행 앨범 — GET /bookings/{id}/album → {items:[{item_id, buddy_name, date, places, photos}]}
// v3.6: /media 주소(버디가 올린 사진)면 진짜 사진, 예전 시드 값(파일 이름)이거나 못 불러오면 무늬 타일. 다녀온 곳은 버디 활동 기록 순서대로.
import { useParams } from "next/navigation";
import { Fragment, useEffect, useState } from "react";
import { ErrorBox } from "@/components/tourist";
import { errMsg, okv } from "@/components/tourist/format";
import { ActionBar, Node, Photo, TimelineStep, iga, krDate, wa } from "@/components/tourist/trips/util";
import { Button, Hero, LinkButton, Spinner } from "@/components/ui";
import { get } from "@/lib/api";
import type { Album, AlbumItem } from "@/lib/types";
import { mediaSrc } from "@/lib/uploads";

export default function AlbumPage() {
  const { id } = useParams<{ id: string }>();
  const [album, setAlbum] = useState<Album | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    okv(get<Album>(`/bookings/${id}/album`)).then((a) => { if (alive) setAlbum(a); }).catch((e: unknown) => { if (alive) setErr(errMsg(e)); });
    return () => { alive = false; };
  }, [id]);

  const first = album?.items[0];
  const allPhotos = album?.items.flatMap((i) => i.photos).map(mediaSrc).filter((u): u is string => !!u) ?? [];
  const downloadAll = () => {
    for (const url of allPhotos) {
      const a = document.createElement("a");
      a.href = url; a.download = url.split("/").pop() ?? "photo.jpg";
      document.body.appendChild(a); a.click(); a.remove();
    }
  };

  return (
    <>
      <Hero back="/trips" backLabel="내 여행"
        title={first ? <>{krDate(first.date)}<br />{first.buddy_name}{wa(first.buddy_name)} 걸은 날</> : "여행 앨범"}
        sub={first ? `${first.buddy_name}${iga(first.buddy_name)} 올린 사진 ${first.photos.length}장 · 앨범 옵션` : undefined} />

      <div className="px-5">
        <ErrorBox message={err} />
        {!album && !err && <Spinner />}
        {album && album.items.length === 0 && (
          <div className="py-10 text-center">
            <p className="text-[15px] leading-relaxed text-muted">앨범 옵션을 고른 동행이 없어요.<br />다음 버디 예약 때 앨범(₩5,000)을 더하면 버디가 찍은 사진이 여기에 모여요.</p>
            <LinkButton href="/trips" variant="secondary" className="mt-6">내 여행으로</LinkButton>
          </div>
        )}
        {album?.items.map((it, k) => (
          <Fragment key={it.item_id}>
            {k > 0 && (
              <div className="mt-10">
                <h2 className="text-[22px] font-bold leading-snug text-ink">{krDate(it.date)}<br />{it.buddy_name}{wa(it.buddy_name)} 걸은 날</h2>
                <p className="mt-1.5 text-[14px] text-muted">사진 {it.photos.length}장</p>
              </div>
            )}
            <AlbumSection it={it} />
          </Fragment>
        ))}
      </div>

      {album && album.items.length > 0 && (
        <ActionBar>
          <Button variant="secondary" onClick={downloadAll} disabled={allPhotos.length === 0}>사진 모두 내려받기</Button>
        </ActionBar>
      )}
    </>
  );
}

function AlbumSection({ it }: { it: AlbumItem }) {
  return (
    <section>
      {it.photos.length === 0 ? (
        <p className="mt-2 text-[15px] leading-relaxed text-muted">{it.buddy_name}{iga(it.buddy_name)} 아직 사진을 올리지 않았어요. 동행이 끝나면 여기에 모여요.</p>
      ) : (
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {it.photos.map((v, i) => {
            const src = mediaSrc(v);
            const photo = <Photo src={src ?? ""} alt={`${it.buddy_name}${wa(it.buddy_name)} 걸은 날 사진 ${i + 1}`} className="h-full w-full" />;
            return src ? (
              <a key={v + i} href={src} target="_blank" rel="noreferrer" className="block aspect-square overflow-hidden rounded-[10px]" aria-label={`사진 ${i + 1} 크게 보기`}>{photo}</a>
            ) : <div key={v + i} className="aspect-square overflow-hidden rounded-[10px]">{photo}</div>;
          })}
        </div>
      )}

      {it.places.length > 0 && (
        <>
          <h2 className="mb-4 mt-9 text-[18px] font-bold text-ink">다녀온 곳</h2>
          {it.places.map((p, i) => (
            <TimelineStep key={p + i} last={i === it.places.length - 1} node={<Node kind="open" />}>
              <div className="text-[16px] font-semibold leading-6 text-ink">{p}</div>
              <div className="mt-0.5 text-[14px] text-muted">{i === 0 ? "출발" : i === it.places.length - 1 ? "마지막 장소" : `${i + 1}번째 장소`}</div>
            </TimelineStep>
          ))}
        </>
      )}
    </section>
  );
}
