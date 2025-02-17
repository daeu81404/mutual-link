import React, { useEffect, useRef, useState } from "react";
import { Drawer, Button, Space, Tabs, Radio, Spin } from "antd";
import { Document, Page, pdfjs } from "react-pdf";
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

// 전역 객체 타입 정의
declare global {
  interface Window {
    cornerstone: any;
    cornerstoneTools: any;
    cornerstoneWADOImageLoader: any;
    dicomParser: any;
    Hammer: any;
  }
}

// Cornerstone 초기화 함수
const initializeCornerstone = async () => {
  try {
    const cs = window.cornerstone;
    const csTools = window.cornerstoneTools;
    const csWADOImageLoader = window.cornerstoneWADOImageLoader;
    const dicomParser = window.dicomParser;
    const Hammer = window.Hammer;

    if (!cs || !csTools || !csWADOImageLoader || !dicomParser || !Hammer) {
      throw new Error("필요한 라이브러리가 로드되지 않았습니다.");
    }

    // Cornerstone Tools 초기화
    csTools.external.cornerstone = cs;
    csTools.external.Hammer = Hammer;

    // WADO Image Loader 초기화
    csWADOImageLoader.external.cornerstone = cs;
    csWADOImageLoader.external.dicomParser = dicomParser;

    // Web Worker 설정
    const isInitialized = (window as any).cornerstoneWADOImageLoaderInitialized;
    if (!isInitialized) {
      csWADOImageLoader.webWorkerManager.initialize({
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
      (window as any).cornerstoneWADOImageLoaderInitialized = true;
    }

    // Cornerstone Tools 초기화
    csTools.init();

    console.log("Cornerstone 초기화 완료");
  } catch (error) {
    console.error("Cornerstone 초기화 실패:", error);
    throw error;
  }
};

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

  // 컴포넌트 마운트 시 Cornerstone 초기화
  useEffect(() => {
    let retryCount = 0;
    const maxRetries = 5;
    const retryInterval = 1000; // 1초

    const initWithRetry = async () => {
      try {
        await initializeCornerstone();
      } catch (error) {
        console.error(`Cornerstone 초기화 시도 ${retryCount + 1} 실패:`, error);
        if (retryCount < maxRetries) {
          retryCount++;
          setTimeout(initWithRetry, retryInterval);
        } else {
          setError(
            "Cornerstone 초기화에 실패했습니다. 페이지를 새로고침해주세요."
          );
        }
      }
    };

    initWithRetry();

    return () => {
      if (dicomContainerRef.current) {
        window.cornerstone.disable(dicomContainerRef.current);
      }
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, []);

  // 모달이 열릴 때 실행되는 useEffect
  useEffect(() => {
    if (visible) {
      setIsLoading(true);
      setActiveTab("dicom");
      setCurrentDicomIndex(0);

      setTimeout(() => {
        if (dicomContainerRef.current && files.dicom.length > 0) {
          try {
            // Cornerstone element 초기화
            if (!dicomContainerRef.current.dataset.cornerstoneEnabled) {
              window.cornerstone.enable(dicomContainerRef.current);
            }

            // DICOM 파일 로드
            const file = files.dicom[0];
            const blob = new Blob([file], { type: "application/dicom" });
            const imageId =
              window.cornerstoneWADOImageLoader.wadouri.fileManager.add(blob);

            window.cornerstone.loadImage(imageId).then(
              (image: any) => {
                if (dicomContainerRef.current) {
                  window.cornerstone.displayImage(
                    dicomContainerRef.current,
                    image
                  );

                  // 도구 설정
                  const WwwcTool = window.cornerstoneTools.WwwcTool;
                  const PanTool = window.cornerstoneTools.PanTool;
                  const ZoomTool = window.cornerstoneTools.ZoomTool;

                  window.cornerstoneTools.addTool(WwwcTool);
                  window.cornerstoneTools.addTool(PanTool);
                  window.cornerstoneTools.addTool(ZoomTool);

                  window.cornerstoneTools.setToolActive("Wwwc", {
                    mouseButtonMask: 1,
                  });
                  window.cornerstoneTools.setToolActive("Pan", {
                    mouseButtonMask: 2,
                  });
                  window.cornerstoneTools.setToolActive("Zoom", {
                    mouseButtonMask: 4,
                  });
                }
                setIsLoading(false);
              },
              (error: any) => {
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
        window.cornerstone.disable(dicomContainerRef.current);
      }
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    }
  }, [visible, files.dicom]);

  // PDF 탭 활성화 시 실행되는 useEffect
  useEffect(() => {
    if (visible && activeTab === "pdf" && files.pdf.length > 0) {
      const loadPdf = async () => {
        try {
          setIsPdfLoading(true);
          setError(null);
          const blob = new Blob([files.pdf[selectedPdfIndex || 0]], {
            type: "application/pdf",
          });
          const url = URL.createObjectURL(blob);
          setPdfUrl(url);
        } catch (error) {
          const err = error as Error;
          setError(`PDF 파일을 로드하는데 실패했습니다: ${err.message}`);
        } finally {
          setIsPdfLoading(false);
        }
      };

      loadPdf();

      return () => {
        if (pdfUrl) {
          URL.revokeObjectURL(pdfUrl);
        }
      };
    }
  }, [visible, activeTab, files.pdf, selectedPdfIndex]);

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
        window.cornerstone.disable(containerRef.current);
      }
      window.cornerstone.enable(containerRef.current);

      const file = files.dicom[index];
      const blob = new Blob([file], { type: "application/dicom" });
      const imageId =
        window.cornerstoneWADOImageLoader.wadouri.fileManager.add(blob);

      window.cornerstone.loadImage(imageId).then(
        (image: any) => {
          if (containerRef.current) {
            window.cornerstone.displayImage(containerRef.current, image);
          }
        },
        (error: Error) => {
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
      window.cornerstone.disable(dicomContainerRef.current);
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
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                minHeight: "calc(90vh - 250px)",
                background: "white",
                position: "relative",
                zIndex: 1002,
              }}
            >
              <Spin spinning={isPdfLoading} tip="PDF 파일을 불러오는 중...">
                <Space style={{ marginBottom: 16 }}>
                  <Button
                    onClick={() => {
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
                <div
                  style={{
                    flex: 1,
                    overflow: "auto",
                    padding: "16px 0",
                    background: "white",
                  }}
                >
                  <Document
                    file={pdfUrl}
                    onLoadSuccess={({ numPages }) => {
                      setNumPages(numPages);
                      setIsPdfLoading(false);
                    }}
                    onLoadError={(error: Error) => {
                      setError("PDF 파일을 로드하는데 실패했습니다.");
                      setIsPdfLoading(false);
                    }}
                    loading={
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "center",
                          alignItems: "center",
                          minHeight: 200,
                        }}
                      >
                        <Spin tip="PDF 파일을 불러오는 중..." />
                      </div>
                    }
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
                      onLoadSuccess={() => {}}
                      onRenderError={(error: Error) => {
                        setError("PDF 페이지를 로드하는데 실패했습니다.");
                      }}
                      loading={
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            minHeight: 200,
                          }}
                        >
                          <Spin tip="페이지를 불러오는 중..." />
                        </div>
                      }
                    />
                  </Document>
                </div>
              </Spin>
            </div>
          ) : (
            <div>
              {files.pdf.map((_, index) => (
                <Button
                  key={index}
                  style={{ marginBottom: 8, display: "block" }}
                  onClick={() => {
                    setSelectedPdfIndex(index);
                    setPageNumber(1);
                    if (pdfUrl) {
                      URL.revokeObjectURL(pdfUrl);
                    }
                    const blob = new Blob([files.pdf[index]], {
                      type: "application/pdf",
                    });
                    const url = URL.createObjectURL(blob);
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
      className="file-viewer-modal"
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
