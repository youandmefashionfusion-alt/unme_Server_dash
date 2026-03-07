"use client";
import { useEffect } from "react";
import AOS from "aos";
import "aos/dist/aos.css";

export default function AOSInitializer() {
  useEffect(() => {
    AOS.init({
      duration: 1000,
      once: false, 
      mirror: true,
      easing: "ease-out-cubic",
      offset: 100,
    });
  }, []);

  return null; // nothing to render
}
