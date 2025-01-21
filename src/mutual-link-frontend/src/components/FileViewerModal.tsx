import React, { useEffect, useRef, useState } from "react";
import { Drawer, Button, Space, Tabs, Radio, Spin } from "antd";
import cornerstone from "cornerstone-core";
import cornerstoneWADOImageLoader from "cornerstone-wado-image-loader";
import cornerstoneTools from "cornerstone-tools";
import Hammer from "hammerjs";
import { Document, Page, pdfjs } from "react-pdf";
import dicomParser from "dicom-parser";
import {
  FileImageOutlined,
  FilePdfOutlined,
  PictureOutlined,
} from "@ant-design/icons";
import type { RadioChangeEvent } from "antd";

// PDF.js 워커 및 스타일 설정
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

// PDF 스타일 import
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";

// Cornerstone Tools 초기화
console.log("Cornerstone 초기화 시작");
cornerstoneTools.external.cornerstone = cornerstone;
cornerstoneTools.external.Hammer = Hammer;
console.log("Cornerstone Tools 초기화 완료");

interface FileViewerModalProps {
  visible: boolean;
  onClose: () => void;
  files: {
    dicom: ArrayBuffer[];
    images: ArrayBuffer[];
    pdf: ArrayBuffer[];
  };
}

export default function FileViewerModal({
  visible,
  onClose,
  files,
}: FileViewerModalProps) {
  const [currentDicomIndex, setCurrentDicomIndex] = useState(0);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const dicomContainerRef = useRef<HTMLDivElement>(null);
  const [numPages, setNumPages] = useState<number>(1);
  const [pageNumber, setPageNumber] = useState(1);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("dicom");
  const [dicomViewMode, setDicomViewMode] = useState<"scroll" | "expand">(
    "scroll"
  );
  const [imageViewMode, setImageViewMode] = useState<"scroll" | "expand">(
    "scroll"
  );
  const [selectedPdfIndex, setSelectedPdfIndex] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [scrollAccumulator, setScrollAccumulator] = useState(0);
  const SCROLL_THRESHOLD = 100; // 스크롤 임계값 설정
  const [isPdfLoading, setIsPdfLoading] = useState(false);

  useEffect(() => {
    console.log("FileViewerModal useEffect 시작");
    try {
      // Cornerstone 초기화
      cornerstoneWADOImageLoader.external.cornerstone = cornerstone;
      cornerstoneWADOImageLoader.external.dicomParser = dicomParser;
      console.log("WADO Image Loader 초기화 시작");
      cornerstoneWADOImageLoader.webWorkerManager.initialize({
        maxWebWorkers: navigator.hardwareConcurrency || 1,
        startWebWorkersOnDemand: true,
        taskConfiguration: {
          decodeTask: {
            initializeCodecsOnStartup: true,
            usePDFJS: false,
            strict: false,
          },
        },
      });
      console.log("WADO Image Loader 초기화 완료");

      // PDF.js 워커 설정
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.js",
        import.meta.url
      ).toString();
    } catch (error) {
      const err = error as Error;
      console.error("초기화 중 에러 발생:", err);
      setError(`초기화 중 에러가 발생했습니다: ${err.message}`);
    }

    return () => {
      console.log("FileViewerModal cleanup 시작");
      if (dicomContainerRef.current) {
        cornerstone.disable(dicomContainerRef.current);
      }
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
      console.log("FileViewerModal cleanup 완료");
    };
  }, []);

  // 모달이 열릴 때 실행되는 useEffect
  useEffect(() => {
    if (visible) {
      setIsLoading(true);
      // 모달이 열릴 때 DICOM 탭을 기본으로 설정하고 약간의 딜레이 후 초기화
      setActiveTab("dicom");
      setCurrentDicomIndex(0);

      // 약간의 딜레이 후 DICOM 초기화 (DOM이 완전히 렌더링된 후)
      setTimeout(() => {
        if (dicomContainerRef.current && files.dicom.length > 0) {
          try {
            // Cornerstone 초기화
            cornerstone.enable(dicomContainerRef.current);

            // 도구 초기화
            cornerstoneTools.init();

            // 도구 설정
            const WwwcTool = cornerstoneTools.WwwcTool;
            const PanTool = cornerstoneTools.PanTool;
            const ZoomTool = cornerstoneTools.ZoomTool;

            // 도구 추가 및 활성화
            cornerstoneTools.addTool(WwwcTool);
            cornerstoneTools.addTool(PanTool);
            cornerstoneTools.addTool(ZoomTool);

            cornerstoneTools.setToolActive("Wwwc", { mouseButtonMask: 1 });
            cornerstoneTools.setToolActive("Pan", { mouseButtonMask: 2 });
            cornerstoneTools.setToolActive("Zoom", { mouseButtonMask: 4 });

            // DICOM 파일 로드
            const file = files.dicom[0];
            const blob = new Blob([file], { type: "application/dicom" });
            const imageId =
              cornerstoneWADOImageLoader.wadouri.fileManager.add(blob);

            cornerstone.loadImage(imageId).then(
              (image) => {
                if (dicomContainerRef.current) {
                  cornerstone.displayImage(dicomContainerRef.current, image);
                }
                setIsLoading(false);
              },
              (error) => {
                console.error("DICOM 이미지 로드 실패:", error);
                setError("DICOM 이미지를 로드하는데 실패했습니다.");
                setIsLoading(false);
              }
            );
          } catch (error) {
            console.error("DICOM 초기화 실패:", error);
            setError("DICOM 뷰어를 초기화하는데 실패했습니다.");
            setIsLoading(false);
          }
        } else {
          setIsLoading(false);
        }
      }, 100);
    } else {
      // 모달이 닫힐 때 cleanup
      if (dicomContainerRef.current?.dataset.cornerstoneEnabled) {
        cornerstone.disable(dicomContainerRef.current);
      }
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    }
  }, [visible, files.dicom]);

  // PDF 탭 활성화 시 실행되는 useEffect
  useEffect(() => {
    console.log("[PDF Debug] useEffect 시작", {
      visible,
      activeTab,
      pdfLength: files.pdf.length,
    });
    if (!visible || activeTab !== "pdf" || !files.pdf.length) return;

    const loadPdf = async () => {
      try {
        console.log("[PDF Debug] PDF 로딩 시작");
        setIsPdfLoading(true);
        setError(null);
        const blob = new Blob([files.pdf[0]], { type: "application/pdf" });
        console.log("[PDF Debug] Blob 생성 완료", { size: blob.size });
        const url = URL.createObjectURL(blob);
        console.log("[PDF Debug] URL 생성 완료", { url });
        setPdfUrl(url);
      } catch (error) {
        const err = error as Error;
        console.error("[PDF Debug] PDF 로드 실패:", err);
        setError(`PDF 파일을 로드하는데 실패했습니다: ${err.message}`);
      } finally {
        console.log("[PDF Debug] PDF 로딩 완료");
        setIsPdfLoading(false);
      }
    };

    loadPdf();

    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [visible, activeTab, files.pdf]);

  const handlePrevDicom = () => {
    setCurrentDicomIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNextDicom = () => {
    setCurrentDicomIndex((prev) => Math.min(files.dicom.length - 1, prev + 1));
  };

  const handlePrevPage = () => {
    setPageNumber((prev) => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setPageNumber((prev) => Math.min(numPages, prev + 1));
  };

  // DICOM 파일 렌더링 함수
  const renderDicomFile = (
    index: number,
    containerRef: React.RefObject<HTMLDivElement>
  ) => {
    if (!containerRef.current || !files.dicom[index]) return;

    try {
      if (containerRef.current.dataset.cornerstoneEnabled) {
        cornerstone.disable(containerRef.current);
      }
      cornerstone.enable(containerRef.current);

      const file = files.dicom[index];
      const blob = new Blob([file], { type: "application/dicom" });
      const imageId = cornerstoneWADOImageLoader.wadouri.fileManager.add(blob);

      cornerstone.loadImage(imageId).then(
        (image) => {
          if (containerRef.current) {
            cornerstone.displayImage(containerRef.current, image);
          }
        },
        (error) => {
          console.error("DICOM 이미지 로드 실패:", error);
          setError("DICOM 이미지를 로드하는데 실패했습니다.");
        }
      );
    } catch (error) {
      console.error("DICOM 초기화 실패:", error);
      setError("DICOM 뷰어를 초기화하는데 실패했습니다.");
    }
  };

  // currentDicomIndex가 변경될 때마다 DICOM 이미지를 업데이트하는 useEffect 추가
  useEffect(() => {
    if (
      dicomViewMode === "scroll" &&
      dicomContainerRef.current &&
      files.dicom[currentDicomIndex]
    ) {
      renderDicomFile(currentDicomIndex, dicomContainerRef);
    }
  }, [currentDicomIndex, dicomViewMode]);

  // 스크롤 이벤트 핸들러 수정
  const handleScroll = (
    e: React.WheelEvent<HTMLDivElement>,
    type: "dicom" | "images"
  ) => {
    e.preventDefault();
    const { deltaY } = e;

    setScrollAccumulator((prev) => {
      const newAccumulator = prev + deltaY;

      if (Math.abs(newAccumulator) >= SCROLL_THRESHOLD) {
        if (type === "dicom") {
          if (
            newAccumulator > 0 &&
            currentDicomIndex < files.dicom.length - 1
          ) {
            setCurrentDicomIndex((prev) => prev + 1);
          } else if (newAccumulator < 0 && currentDicomIndex > 0) {
            setCurrentDicomIndex((prev) => prev - 1);
          }
        } else if (type === "images") {
          if (
            newAccumulator > 0 &&
            currentImageIndex < files.images.length - 1
          ) {
            setCurrentImageIndex((prev) => prev + 1);
          } else if (newAccumulator < 0 && currentImageIndex > 0) {
            setCurrentImageIndex((prev) => prev - 1);
          }
        }
        return 0; // 누적값 초기화
      }
      return newAccumulator;
    });
  };

  const handleClose = () => {
    // 모든 상태 초기화
    setCurrentDicomIndex(0);
    setCurrentImageIndex(0);
    setNumPages(1);
    setPageNumber(1);
    setPdfUrl(null);
    setError(null);
    setActiveTab("dicom");
    setDicomViewMode("scroll");
    setImageViewMode("scroll");
    setSelectedPdfIndex(null);
    setIsLoading(false);
    setScrollAccumulator(0); // 스크롤 누적값도 초기화

    // cleanup
    if (dicomContainerRef.current?.dataset.cornerstoneEnabled) {
      cornerstone.disable(dicomContainerRef.current);
    }
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
    }

    onClose();
  };

  // DICOM 탭의 내용
  const renderDicomContent = () => (
    <div style={{ marginBottom: 16 }}>
      <Space style={{ marginBottom: 16 }}>
        <Radio.Group
          value={dicomViewMode}
          onChange={(e: RadioChangeEvent) => setDicomViewMode(e.target.value)}
          optionType="button"
          buttonStyle="solid"
        >
          <Radio.Button value="scroll">스크롤로 이동</Radio.Button>
          <Radio.Button value="expand">펼쳐보기</Radio.Button>
        </Radio.Group>
      </Space>

      <div
        style={{
          height: dicomViewMode === "scroll" ? "calc(90vh - 250px)" : "auto",
          overflow: dicomViewMode === "scroll" ? "hidden" : "auto",
        }}
        onWheel={(e) => {
          e.preventDefault();
          handleScroll(e, "dicom");
        }}
      >
        {dicomViewMode === "expand" ? (
          // 펼쳐보기 모드
          <div
            style={{
              height: "calc(90vh - 250px)",
              overflowY: "auto",
            }}
            onWheel={(e) => {
              const target = e.target as HTMLElement;
              const container = target.closest('[id^="dicom-container-"]');
              if (container) {
                e.stopPropagation();
                e.preventDefault();
                container.parentElement?.parentElement?.scrollBy({
                  top: e.deltaY,
                });
              }
            }}
          >
            {Array.from({ length: files.dicom.length }).map((_, index) => (
              <div
                key={index}
                style={{
                  marginBottom: 24,
                }}
              >
                <div style={{ marginBottom: 8 }}>DICOM 파일 {index + 1}</div>
                <div
                  id={`dicom-container-${index}`}
                  style={{
                    width: "100%",
                    height: "calc(90vh - 350px)",
                    backgroundColor: "black",
                    position: "relative",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      zIndex: 1,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          // 스크롤 모드
          <div style={{ height: "100%" }}>
            <div style={{ marginBottom: 8 }}>
              DICOM 파일 {currentDicomIndex + 1} / {files.dicom.length}
            </div>
            <div
              ref={dicomContainerRef}
              style={{
                width: "100%",
                height: "calc(100% - 32px)",
                backgroundColor: "black",
                position: "relative",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  zIndex: 1,
                }}
                onWheel={(e) => {
                  e.stopPropagation();
                  handleScroll(e, "dicom");
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // 이미지 탭의 내용
  const renderImageContent = () => (
    <div style={{ padding: "16px 0" }}>
      <Space style={{ marginBottom: 16 }}>
        <Radio.Group
          value={imageViewMode}
          onChange={(e: RadioChangeEvent) => setImageViewMode(e.target.value)}
          optionType="button"
          buttonStyle="solid"
        >
          <Radio.Button value="scroll">스크롤로 이동</Radio.Button>
          <Radio.Button value="expand">펼쳐보기</Radio.Button>
        </Radio.Group>
      </Space>

      <div
        style={{
          height: imageViewMode === "scroll" ? "calc(90vh - 250px)" : "auto",
          overflow: imageViewMode === "scroll" ? "hidden" : "auto",
        }}
        onWheel={(e) => imageViewMode === "scroll" && handleScroll(e, "images")}
      >
        {imageViewMode === "expand" ? (
          // 펼쳐보기 모드
          <div>
            {Array.from({ length: files.images.length }).map((_, index) => {
              const url = URL.createObjectURL(new Blob([files.images[index]]));
              return (
                <div
                  key={index}
                  style={{
                    marginBottom: 24,
                    scrollSnapAlign: "start",
                  }}
                >
                  <div style={{ marginBottom: 8 }}>이미지 {index + 1}</div>
                  <img
                    src={url}
                    alt={`이미지 ${index + 1}`}
                    style={{
                      width: "100%",
                      height: "calc(90vh - 350px)",
                      objectFit: "contain",
                    }}
                    onLoad={() => URL.revokeObjectURL(url)}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          // 스크롤 모드
          <div style={{ height: "100%" }}>
            {files.images.map((image, index) => {
              if (index !== currentImageIndex) return null;
              const url = URL.createObjectURL(new Blob([image]));
              return (
                <div key={index} style={{ height: "100%" }}>
                  <div style={{ marginBottom: 8 }}>이미지 {index + 1}</div>
                  <img
                    src={url}
                    alt={`이미지 ${index + 1}`}
                    style={{
                      display: "block",
                      width: "100%",
                      height: "calc(100% - 32px)",
                      objectFit: "contain",
                    }}
                    onLoad={() => URL.revokeObjectURL(url)}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  const items = [
    {
      key: "dicom",
      label: (
        <span>
          <FileImageOutlined />
          DICOM ({files.dicom.length})
        </span>
      ),
      children: files.dicom.length > 0 && renderDicomContent(),
    },
    {
      key: "images",
      label: (
        <span>
          <PictureOutlined />
          이미지 ({files.images.length})
        </span>
      ),
      children: files.images.length > 0 && renderImageContent(),
    },
    {
      key: "pdf",
      label: (
        <span>
          <FilePdfOutlined />
          PDF ({files.pdf.length})
        </span>
      ),
      children: files.pdf.length > 0 && (
        <div style={{ padding: "16px 0" }}>
          {selectedPdfIndex !== null ? (
            <Spin spinning={isPdfLoading} tip="PDF 파일을 불러오는 중...">
              <div
                style={{
                  position: "relative",
                  zIndex: 1002,
                  background: "white",
                }}
              >
                <Space style={{ marginBottom: 16 }}>
                  <Button
                    onClick={() => {
                      console.log("[PDF Debug] 목록으로 돌아가기 클릭");
                      setSelectedPdfIndex(null);
                      setPdfUrl(null);
                    }}
                  >
                    목록으로 돌아가기
                  </Button>
                  <Button onClick={handlePrevPage} disabled={pageNumber === 1}>
                    이전 페이지
                  </Button>
                  <span>
                    {pageNumber} / {numPages}
                  </span>
                  <Button
                    onClick={handleNextPage}
                    disabled={pageNumber === numPages}
                  >
                    다음 페이지
                  </Button>
                </Space>
                <div style={{ background: "white", padding: "16px 0" }}>
                  <Document
                    file={pdfUrl}
                    onLoadSuccess={({ numPages }) => {
                      console.log("[PDF Debug] Document 로드 성공", {
                        numPages,
                      });
                      setNumPages(numPages);
                      setIsPdfLoading(false);
                    }}
                    onLoadError={(error: Error) => {
                      console.error("[PDF Debug] Document 로드 실패:", error);
                      setError("PDF 파일을 로드하는데 실패했습니다.");
                      setIsPdfLoading(false);
                    }}
                    loading={<Spin tip="PDF 파일을 불러오는 중..." />}
                    options={{
                      cMapUrl: "https://cdn.jsdelivr.net/npm/pdfjs-dist/cmaps/",
                      cMapPacked: true,
                      standardFontDataUrl:
                        "https://cdn.jsdelivr.net/npm/pdfjs-dist/standard_fonts/",
                      enableXfa: true,
                      useSystemFonts: true,
                    }}
                  >
                    <Page
                      pageNumber={pageNumber}
                      width={Math.min(window.innerWidth - 48, 1152)}
                      renderTextLayer={true}
                      renderAnnotationLayer={true}
                      onLoadSuccess={() => {
                        console.log("[PDF Debug] Page 로드 성공", {
                          pageNumber,
                        });
                      }}
                      onRenderError={(error: Error) => {
                        console.error("[PDF Debug] Page 렌더링 실패:", error);
                        setError("PDF 페이지를 로드하는데 실패했습니다.");
                      }}
                      loading={<Spin tip="페이지를 불러오는 중..." />}
                    />
                  </Document>
                </div>
              </div>
            </Spin>
          ) : (
            <div>
              {files.pdf.map((_, index) => (
                <Button
                  key={index}
                  style={{ marginBottom: 8, display: "block" }}
                  onClick={() => {
                    console.log("[PDF Debug] PDF 파일 선택", { index });
                    setSelectedPdfIndex(index);
                    setPageNumber(1);
                    if (pdfUrl) {
                      console.log("[PDF Debug] 기존 URL 해제");
                      URL.revokeObjectURL(pdfUrl);
                    }
                    const blob = new Blob([files.pdf[index]], {
                      type: "application/pdf",
                    });
                    const url = URL.createObjectURL(blob);
                    console.log("[PDF Debug] 새 URL 생성", { url });
                    setPdfUrl(url);
                  }}
                >
                  PDF 파일 {index + 1}
                </Button>
              ))}
            </div>
          )}
        </div>
      ),
    },
  ];

  // activeTab이 변경될 때 DICOM 파일을 다시 렌더링하는 useEffect 수정
  useEffect(() => {
    if (activeTab === "dicom" && dicomViewMode === "expand") {
      // 약간의 딜레이 후 모든 DICOM 파일 다시 렌더링
      setTimeout(() => {
        Array.from({ length: files.dicom.length }).forEach((_, index) => {
          const element = document.getElementById(
            `dicom-container-${index}`
          ) as HTMLDivElement;
          if (element) {
            renderDicomFile(index, { current: element });
          }
        });
      }, 100);
    }
  }, [activeTab, dicomViewMode]);

  return (
    <Drawer
      visible={visible}
      onClose={handleClose}
      placement="bottom"
      height="90vh"
      width="100%"
      bodyStyle={{ padding: 0, overflow: "auto" }}
      zIndex={1000}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "0 24px",
          position: "relative",
          zIndex: 1001,
        }}
      >
        <Spin spinning={isLoading} tip="파일을 불러오는 중...">
          <Tabs
            activeKey={activeTab}
            onChange={(key) => {
              setActiveTab(key);
            }}
            items={items}
            style={{ padding: "16px 0" }}
          />
          {error && (
            <div style={{ color: "red", marginBottom: "16px" }}>{error}</div>
          )}
        </Spin>
      </div>
    </Drawer>
  );
}
