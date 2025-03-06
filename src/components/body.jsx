import React from 'react';
import { useState, useEffect, useRef } from 'react';
import { render } from 'react-dom';
import { marked } from 'marked';
import markedKatex from 'marked-katex-extension';

const renderer = new marked.Renderer();
renderer.table = (header, body) => {
  return `<div class="uk-overflow-auto uk-width-1-1"><table class="uk-table uk-table-small uk-text-small uk-table-divider"> ${header} ${body} </table></div>`;
};

marked.use(markedKatex({ throwOnError: false }));
marked.use({ renderer: renderer });

const SplitOverlay = ({ overlay }) => {
  // overlay가 없으면 아무것도 렌더링하지 않음
  console.log(overlay);
  if (!overlay) return null;

  const item_json = overlay;
  /**
   * overlay 예시:
   * {
   *   "back": {
   *     "type": "image|video",
   *     "content": "URL"
   *   },
   *   "front": {
   *     "type": "image|video",
   *     "content": "URL"
   *   }
   * }
   */

  // Bar의 위치(픽셀 또는 비율)를 state로 관리
  const [barPosition, setBarPosition] = useState(150); // 처음에 50% 위치
  const [isDragging, setIsDragging] = useState(false);

  const containerRef = useRef(null);
  const videoBackRef = useRef(null);
  const videoFrontRef = useRef(null);
  const [loadedCount, setLoadedCount] = useState(0);
  // 마우스/터치 다운 이벤트
  const handleMouseDown = () => {
    setIsDragging(true);
  };

  // 마우스/터치 업 이벤트
  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // 마우스/터치 무브 이벤트
  const handleMouseMove = (e) => {
    if (!isDragging || !containerRef.current) return;

    // e.clientX가 유효하지 않은 (모바일 터치 등) 상황 대비
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;

    const rect = containerRef.current.getBoundingClientRect();
    const offsetX = clientX - rect.left;
    // 범위 제한
    const newPos = Math.max(0, Math.min(offsetX, rect.width));

    // 실제 px 값이므로, 나중에 clip-path나 width 계산 시 활용
    setBarPosition(newPos);
  };

  // ─────────────────────────
  // Mouse Wheel Scroll
  // ─────────────────────────
  const handleWheel = (e) => {
    if (!containerRef.current) return;
    e.preventDefault();

    const rect = containerRef.current.getBoundingClientRect();

    const scrollSpeed = 3; // 휠 스크롤 한 칸 당 얼마만큼 이동할지
    let newPos = barPosition + e.deltaY * 0.1 * scrollSpeed;

    // Bar 위치 제한
    newPos = Math.max(0, Math.min(newPos, rect.width));
    setBarPosition(newPos);
  };

  useEffect(() => {
    // 마우스/터치 이벤트 리스너 전역 등록
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    // 모바일 터치 대응
    window.addEventListener('touchmove', handleMouseMove);
    window.addEventListener('touchend', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);

      window.removeEventListener('touchmove', handleMouseMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDragging]);

  // Container의 폭(width)와 barPosition을 이용하여 clipPath 계산
  // container의 width가 0인 상황을 대비해서 안전 처리
  const containerWidth = containerRef.current
    ? containerRef.current.getBoundingClientRect().width
    : 0;

  // front를 clip-path로 마스킹할 때, right 부분을 (전체 - barPosition)로 설정
  // 예: inset(0px <right> 0px 0px)
  const rightClip = containerWidth - barPosition;
  const handleVideoLoaded = () => {
    setLoadedCount((prev) => prev + 1);
  };

  useEffect(() => {
    // item_json에 video 타입이 아닌 image가 섞여 있을 수도 있음
    const totalVideos = [item_json.back, item_json.front].filter(
      (m) => m.type === 'video'
    ).length;

    if (loadedCount === totalVideos && totalVideos > 0) {
      // 두 비디오 레퍼런스가 있을 때
      const vBack = videoBackRef.current;
      const vFront = videoFrontRef.current;

      if (vBack && vFront) {
        // 재생 위치를 0으로 맞춤
        vBack.currentTime = 0;
        vFront.currentTime = 0;

        // 동시에 플레이 (권장: Promise.all)
        Promise.all([vBack.play(), vFront.play()]).catch((err) => {
          console.log('Video play error', err);
        });
      } else if (vBack) {
        // 하나만 비디오인 경우
        vBack.currentTime = 0;
        vBack
          .play()
          .catch((err) => console.log('Single video play error', err));
      } else if (vFront) {
        // 위와 동일
        vFront.currentTime = 0;
        vFront
          .play()
          .catch((err) => console.log('Single video play error', err));
      }
    }
  }, [loadedCount, item_json.back, item_json.front]);

  // Media를 렌더링하는 함수 (back, front 공용)
  const renderMedia = (mediaInfo, customStyle = {}) => {
    const { type, url } = mediaInfo;
    if (type === 'video') {
      return (
        <video
          ref={mediaInfo === item_json.back ? videoBackRef : videoFrontRef}
          onLoadedData={handleVideoLoaded}
          autoPlay
          muted
          loop
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            ...customStyle,
          }}
        >
          <source src={url} type="video/mp4" />
        </video>
      );
    }
    // type === 'image'
    return (
      <img
        src={url}
        alt=""
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          ...customStyle,
        }}
      />
    );
  };

  return (
    <div
      ref={containerRef}
      className="uk-position-relative uk-margin uk-padding" // UIkit 클래스 예시
      style={{
        width: '800px', // 필요에 따라 조절
        height: '450px', // 필요에 따라 조절
        overflow: 'hidden', // 겹친 부분 잘라내기
      }}
      onMouseDown={(e) => e.preventDefault()} // 드래그 select 방지
      onTouchStart={(e) => e.preventDefault()}
      onWheel={handleWheel}
    >
      {/* Back Media */}
      {renderMedia(item_json.back)}

      {/* Front Media (clip-path로 왼쪽만 보이도록) */}
      {renderMedia(item_json.front, {
        clipPath: `inset(0px ${rightClip}px 0px 0px)`,
      })}

      {/* Bar (↔ 아이콘) */}
      <div
        onMouseDown={handleMouseDown}
        onTouchStart={() => setIsDragging(true)}
        className="uk-flex uk-flex-middle uk-flex-center"
        style={{
          position: 'absolute',
          top: 0,
          left: `${barPosition}px`,
          width: '25px',
          height: '100%',
          cursor: 'ew-resize',
          backgroundColor: 'rgba(0,0,0,0.2)',
          boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.5)',
          touchAction: 'none',
        }}
      >
        <span style={{ userSelect: 'none', color: '#fff', fontSize: '14px' }}>
          ↔
        </span>
      </div>
    </div>
  );
};

class Content extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    if (this.props.title)
      return (
        <h2 className="uk-text-bold uk-margin-top uk-heading-line uk-text-center">
          <span>{this.props.title}</span>
        </h2>
      );
    if (this.props.text)
      return (
        <div
          dangerouslySetInnerHTML={{ __html: marked.parse(this.props.text) }}
        />
      );
    if (this.props.image)
      return (
        <img
          src={`${this.props.image}`}
          className="uk-align-center uk-responsive-width"
          alt=""
        />
      );
    if (this.props.overlay) {
      return <SplitOverlay overlay={this.props.overlay} />;
    }
    return null;
  }
}

export default class Body extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    return this.props.body ? (
      <div className="uk-section">
        {this.props.body.map((subsection, idx) => {
          return (
            <div key={'subsection-' + idx}>
              <Content title={subsection.title} />
              <Content image={subsection.image} />
              <Content text={subsection.text} />
              <Content overlay={subsection.overlay} />
            </div>
          );
        })}
      </div>
    ) : null;
  }
}
