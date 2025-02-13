import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";
import { useEffect, useState } from "react";
import { Button, Spin } from "antd";

// PDF.js 설정
console.log("PDF.js 버전:", pdfjs.version);
console.log("PDF.js 워커 설정 시작");

// 워커 URL을 unpkg에서 가져옵니다 (버전 3.11.174 사용)
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js`;
console.log("PDF.js 워커 URL:", pdfjs.GlobalWorkerOptions.workerSrc);

type Props = {
  file: ArrayBuffer;
};

const PdfViewer = (props: Props) => {
  const [numPages, setNumPages] = useState<number>();
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pageIndex, setPageIndex] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    console.log("PdfViewer useEffect 시작");
    console.log("props.file 존재 여부:", !!props.file);
    console.log(
      "props.file 타입:",
      props.file ? props.file.constructor.name : "없음"
    );
    console.log(
      "props.file 크기:",
      props.file ? props.file.byteLength : "없음"
    );

    const loadPdf = async () => {
      console.log("loadPdf 함수 시작");
      if (!props.file || !isMounted) {
        console.log("조기 종료 조건:", {
          noFile: !props.file,
          notMounted: !isMounted,
        });
        return;
      }

      // 이전 URL 정리
      if (pdfUrl) {
        console.log("이전 URL 정리:", pdfUrl);
        URL.revokeObjectURL(pdfUrl);
      }

      try {
        console.log("Blob 생성 시작");
        const blob = new Blob([props.file], { type: "application/pdf" });
        console.log("Blob 생성 완료:", { size: blob.size, type: blob.type });

        const url = URL.createObjectURL(blob);
        console.log("URL 생성:", url);

        if (!isMounted) {
          console.log("마운트 해제됨, URL 정리");
          URL.revokeObjectURL(url);
          return;
        }

        console.log("URL 설정");
        setPdfUrl(url);
        setError(null);
      } catch (err) {
        console.error("PDF 파일 로드 중 오류:", err);
        setError(
          err instanceof Error ? err.message : "PDF 로드 중 오류가 발생했습니다"
        );
      }
    };

    loadPdf();

    return () => {
      console.log("cleanup 함수 실행");
      isMounted = false;
      if (pdfUrl) {
        console.log("cleanup: URL 정리", pdfUrl);
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [props.file]);

  const handlePrevPage = () => {
    setPageIndex((prev) => (prev > 0 ? prev - 1 : prev));
  };

  const handleNextPage = () => {
    setPageIndex((prev) => (prev < numPages! - 1 ? prev + 1 : prev));
  };

  return (
    <div
      style={{
        width: "100%",
        overflowX: "hidden",
        maxHeight: "90vh",
        overflowY: "auto",
      }}
    >
      {pdfUrl && (
        <>
          <Document
            file={pdfUrl}
            onLoadSuccess={({ numPages }) => {
              console.log("PDF 로드 성공:", { numPages });
              setNumPages(numPages);
              setPageIndex(0);
            }}
            onLoadError={(error) => {
              console.error("PDF 로드 실패:", error);
            }}
            loading={() => (
              <div style={{ textAlign: "center", padding: "20px" }}>
                <Spin size="large" />
                <div style={{ marginTop: "10px" }}>
                  PDF 파일을 불러오는 중...
                </div>
              </div>
            )}
            error={() => (
              <div
                style={{ color: "red", textAlign: "center", padding: "20px" }}
              >
                PDF 로드에 실패했습니다
              </div>
            )}
          >
            <Page
              key={`page_${pageIndex + 1}`}
              pageNumber={pageIndex + 1}
              renderTextLayer={false}
              renderAnnotationLayer={false}
              width={800}
              loading={() => (
                <div style={{ textAlign: "center", padding: "20px" }}>
                  <Spin size="large" />
                  <div style={{ marginTop: "10px" }}>
                    페이지를 불러오는 중...
                  </div>
                </div>
              )}
              error={() => (
                <div
                  style={{ color: "red", textAlign: "center", padding: "20px" }}
                >
                  페이지 로드에 실패했습니다
                </div>
              )}
            />
          </Document>
          {numPages && numPages > 1 && (
            <div
              style={{
                marginTop: "10px",
                display: "flex",
                justifyContent: "center",
                gap: "10px",
              }}
            >
              <Button onClick={handlePrevPage} disabled={pageIndex === 0}>
                이전
              </Button>
              <div style={{ display: "flex", alignItems: "center" }}>
                {pageIndex + 1} / {numPages}
              </div>
              <Button
                onClick={handleNextPage}
                disabled={pageIndex === numPages - 1}
              >
                다음
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default PdfViewer;
