import { ImageResponse } from "next/og";

export const size = {
  width: 512,
  height: 512,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #132437 0%, #244855 45%, #ef7d57 100%)",
          color: "white",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 120,
          fontWeight: 700,
        }}
      >
        $
      </div>
    ),
    size,
  );
}
