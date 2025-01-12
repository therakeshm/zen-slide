/*!
 * ZenSlide v1.0.0
 * A minimalist vanilla JavaScript image slider with GSAP animations
 * MIT License
 * by Rakesh Mandal (https://rakeshmandal.com)
 */

class ZenSlide {
  constructor(options = {}) {
    // Default configuration
    this.config = {
      container: "zen-slide",
      transitionDuration: 2,
      zoomIntensity: 1.05,
      autoplay: true,
      autoplayDuration: 5000,
      pauseOnHover: true,
      startAtSlide: 0,

      // Navigation
      navigation: {
        enabled: true,
        type: "both", // 'dots', 'arrows', 'both'
        position: "bottom", // 'top', 'bottom', 'sides'
      },

      // Touch support
      touch: {
        enabled: true,
        swipeThreshold: 50,
        resistance: 0.3,
        velocityThreshold: 0.3,
      },

      // Loading states
      loading: {
        showIndicator: true,
        preloadNext: true,
        retryCount: 2,
        timeout: 10000,
      },

      // Accessibility
      accessibility: {
        enabled: true,
        announceSlides: true,
        labels: {
          previous: "Previous slide",
          next: "Next slide",
          dot: "Go to slide",
          pause: "Pause slider",
          play: "Play slider",
        },
      },
    };

    // Merge user options
    this.config = this.mergeConfig(this.config, options);

    // Initialize state
    this.state = {
      currentSlide: this.config.startAtSlide,
      isTransitioning: false,
      isPaused: false,
      touchStartX: 0,
      touchStartY: 0,
      touchMoveX: 0,
      touchStartTime: 0,
      imageLoadStatus: new Map(),
      autoplayTimer: null,
    };

    // Initialize slider
    this.init();
  }

  // Utility Deep Merge Function
  mergeConfig(target, source) {
    const output = Object.assign({}, target);
    if (this.isObject(target) && this.isObject(source)) {
      Object.keys(source).forEach((key) => {
        if (this.isObject(source[key])) {
          if (!(key in target)) Object.assign(output, { [key]: source[key] });
          else output[key] = this.mergeConfig(target[key], source[key]);
        } else {
          Object.assign(output, { [key]: source[key] });
        }
      });
    }
    return output;
  }

  isObject(item) {
    return item && typeof item === "object" && !Array.isArray(item);
  }

  init() {
    // Get container
    this.container =
      typeof this.config.container === "string"
        ? document.getElementById(this.config.container)
        : this.config.container;

    if (!this.container) {
      throw new Error("Container not found");
    }

    // Get slides
    this.slides = Array.from(this.container.querySelectorAll(".slide"));
    if (!this.slides.length) {
      throw new Error("No slides found");
    }

    // Check GSAP dependency
    if (typeof gsap === "undefined") {
      throw new Error("GSAP is required for ZenSlide");
    }

    // Create UI elements
    this.createOverlay();
    this.createLoadingIndicator();
    this.initializeImageLoading();

    // Create custom ease
    this.slideEase = CustomEase.create(
      "slideEase",
      "M0,0 C0.25,0.1 0.25,1 1,1"
    );

    // Setup initial slide
    this.slides.forEach((slide, index) => {
      gsap.set(slide, {
        opacity: index === this.state.currentSlide ? 1 : 0,
        scale: 1,
      });
    });
    this.slides[this.state.currentSlide].classList.add("active");

    // Setup features
    if (this.config.navigation.enabled) {
      this.createNavigation();
    }

    this.setupEventListeners();

    if (this.config.touch.enabled) {
      this.setupTouchSupport();
    }

    if (this.config.accessibility.enabled) {
      this.setupAccessibility();
    }

    // Start autoplay if enabled
    if (this.config.autoplay) {
      this.startAutoplay();
    }
  }

  /**
   * Create overlay elements (pause feedback)
   */
  createOverlay() {
    this.overlay = document.createElement("div");
    this.overlay.classList.add("overlay");

    const overlayBg = document.createElement("div");
    overlayBg.classList.add("overlay-background");
    this.overlay.appendChild(overlayBg);

    const pauseFeedback = document.createElement("div");
    pauseFeedback.classList.add("pause-feedback");
    this.overlay.appendChild(pauseFeedback);

    this.container.appendChild(this.overlay);
  }

  /**
   * Create loading indicator
   */
  createLoadingIndicator() {
    if (!this.config.loading.showIndicator) return;

    this.loadingContainer = document.createElement("div");
    this.loadingContainer.classList.add("loading-container");

    const spinner = document.createElement("div");
    spinner.classList.add("loading-spinner");
    this.loadingContainer.appendChild(spinner);

    this.container.appendChild(this.loadingContainer);
  }

  /**
   * Create navigation elements (arrows and dots)
   */
  createNavigation() {
    if (
      this.config.navigation.type === "arrows" ||
      this.config.navigation.type === "both"
    ) {
      const arrowsContainer = document.createElement("div");
      arrowsContainer.classList.add("nav-arrows");

      // Add previous arrow
      const prevArrow = document.createElement("div");
      prevArrow.classList.add("nav-arrow", "prev");
      prevArrow.innerHTML =
        '<svg viewBox="0 0 24 24"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>';
      prevArrow.addEventListener("click", () => this.previous());

      // Add next arrow
      const nextArrow = document.createElement("div");
      nextArrow.classList.add("nav-arrow", "next");
      nextArrow.innerHTML =
        '<svg viewBox="0 0 24 24"><path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z"/></svg>';
      nextArrow.addEventListener("click", () => this.next());

      arrowsContainer.appendChild(prevArrow);
      arrowsContainer.appendChild(nextArrow);
      this.container.appendChild(arrowsContainer); // Append inside .zen-slide
    }

    if (
      this.config.navigation.type === "dots" ||
      this.config.navigation.type === "both"
    ) {
      const dotsContainer = document.createElement("div");
      dotsContainer.classList.add(
        "nav-dots-container",
        this.config.navigation.position
      );

      const dotsWrapper = document.createElement("div");
      dotsWrapper.classList.add("nav-dots");

      this.slides.forEach((_, index) => {
        const dot = document.createElement("div");
        dot.classList.add("nav-dot");
        if (index === this.state.currentSlide) dot.classList.add("active");
        dot.addEventListener("click", () => this.goToSlide(index));
        dotsWrapper.appendChild(dot);
      });

      dotsContainer.appendChild(dotsWrapper);
      this.container.appendChild(dotsContainer); // Append inside .zen-slide
      this.navDots = dotsWrapper.querySelectorAll(".nav-dot");
    }
  }

  initializeImageLoading() {
    this.slides.forEach((slide, index) => {
      const style = window.getComputedStyle(slide);
      const imageUrl = style.backgroundImage.slice(4, -1).replace(/['"]/g, "");

      this.loadImage(imageUrl, index);

      if (this.config.loading.preloadNext && index < this.slides.length - 1) {
        const nextStyle = window.getComputedStyle(this.slides[index + 1]);
        const nextImageUrl = nextStyle.backgroundImage
          .slice(4, -1)
          .replace(/['"]/g, "");
        this.loadImage(nextImageUrl, index + 1);
      }
    });
  }

  loadImage(url, index, retryCount = 0) {
    if (this.config.loading.showIndicator) {
      this.loadingContainer.classList.add("visible");
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      let timeout;

      const cleanup = () => {
        clearTimeout(timeout);
        img.onload = null;
        img.onerror = null;
      };

      img.onload = () => {
        cleanup();
        this.state.imageLoadStatus.set(index, "loaded");
        if (this.config.loading.showIndicator) {
          this.loadingContainer.classList.remove("visible");
        }
        resolve();
      };

      img.onerror = () => {
        cleanup();
        if (retryCount < this.config.loading.retryCount) {
          setTimeout(() => {
            this.loadImage(url, index, retryCount + 1);
          }, 1000);
        } else {
          this.handleImageError(index);
          reject(new Error("Failed to load image"));
        }
      };

      timeout = setTimeout(() => {
        cleanup();
        if (retryCount < this.config.loading.retryCount) {
          this.loadImage(url, index, retryCount + 1);
        } else {
          this.handleImageError(index);
          reject(new Error("Image load timeout"));
        }
      }, this.config.loading.timeout);

      img.src = url;
    });
  }

  handleImageError(index) {
    this.state.imageLoadStatus.set(index, "error");
    const slide = this.slides[index];

    if (!slide.querySelector(".slide-error")) {
      const errorElement = document.createElement("div");
      errorElement.classList.add("slide-error");
      errorElement.textContent = "Failed to load image";
      slide.appendChild(errorElement);
    }

    slide.querySelector(".slide-error").classList.add("visible");

    if (this.config.loading.showIndicator) {
      this.loadingContainer.classList.remove("visible");
    }
  }

  setupEventListeners() {
    if (this.config.pauseOnHover) {
      this.container.addEventListener("mouseenter", () => this.pause());
      this.container.addEventListener("mouseleave", () => this.resume());
    }

    if (this.config.accessibility.enabled) {
      document.addEventListener("keydown", (e) => {
        switch (e.key) {
          case "ArrowLeft":
            this.previous();
            break;
          case "ArrowRight":
            this.next();
            break;
          case "Home":
            this.goToSlide(0);
            break;
          case "End":
            this.goToSlide(this.slides.length - 1);
            break;
        }
      });
    }
  }

  setupTouchSupport() {
    if (!this.config.touch.enabled) return;

    this.container.addEventListener(
      "touchstart",
      (e) => this.handleTouchStart(e),
      { passive: false }
    );
    this.container.addEventListener(
      "touchmove",
      (e) => this.handleTouchMove(e),
      { passive: false }
    );
    this.container.addEventListener("touchend", (e) => this.handleTouchEnd(e), {
      passive: false,
    });
  }

  setupAccessibility() {
    this.container.setAttribute("role", "region");
    this.container.setAttribute("aria-label", "Image Slider");
    this.container.setAttribute("aria-roledescription", "carousel");

    this.makeElementsFocusable();
    this.setupSlideAnnouncements();
  }

  makeElementsFocusable() {
    if (this.navDots) {
      this.navDots.forEach((dot, index) => {
        dot.setAttribute("role", "button");
        dot.setAttribute("tabindex", "0");
        dot.setAttribute(
          "aria-label",
          `${this.config.accessibility.labels.dot} ${index + 1}`
        );
      });
    }

    const arrows = this.container.querySelectorAll(".nav-arrow");
    arrows.forEach((arrow) => {
      arrow.setAttribute("role", "button");
      arrow.setAttribute("tabindex", "0");
      arrow.setAttribute(
        "aria-label",
        arrow.classList.contains("prev")
          ? this.config.accessibility.labels.previous
          : this.config.accessibility.labels.next
      );
    });
  }

  setupSlideAnnouncements() {
    if (!this.config.accessibility.announceSlides) return;

    this.liveRegion = document.createElement("div");
    this.liveRegion.setAttribute("aria-live", "polite");
    this.liveRegion.setAttribute("aria-atomic", "true");
    this.liveRegion.classList.add("sr-only");
    this.container.appendChild(this.liveRegion);
  }

  announceSlideChange(index) {
    if (!this.config.accessibility.announceSlides || !this.liveRegion) return;
    this.liveRegion.textContent = `Showing slide ${index + 1} of ${
      this.slides.length
    }`;
  }

  handleTouchStart(e) {
    if (this.state.isTransitioning) return;

    const touch = e.touches[0];
    this.state.touchStartX = touch.clientX;
    this.state.touchStartY = touch.clientY;
    this.state.touchMoveX = 0;
    this.state.touchStartTime = Date.now();

    this.slides[this.state.currentSlide].classList.add("touch-move");
  }

  handleTouchMove(e) {
    if (!this.state.touchStartX) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - this.state.touchStartX;
    const deltaY = touch.clientY - this.state.touchStartY;

    if (Math.abs(deltaY) > Math.abs(deltaX)) {
      this.state.touchStartX = null;
      return;
    }

    e.preventDefault();

    this.state.touchMoveX = deltaX;
    const transform = deltaX * this.config.touch.resistance;

    gsap.set(this.slides[this.state.currentSlide], {
      x: transform,
    });

    if (this.state.currentSlide > 0) {
      gsap.set(this.slides[this.state.currentSlide - 1], {
        x: transform - this.container.offsetWidth,
        opacity: 1,
      });
    }

    if (this.state.currentSlide < this.slides.length - 1) {
      gsap.set(this.slides[this.state.currentSlide + 1], {
        x: transform + this.container.offsetWidth,
        opacity: 1,
      });
    }
  }

  handleTouchEnd() {
    if (!this.state.touchStartX) return;

    const deltaX = this.state.touchMoveX;
    const timeDiff = Date.now() - this.state.touchStartTime;
    const velocity = Math.abs(deltaX / timeDiff);

    this.slides[this.state.currentSlide].classList.remove("touch-move");

    const shouldChange =
      Math.abs(deltaX) > this.config.touch.swipeThreshold ||
      velocity > this.config.touch.velocityThreshold;

    if (shouldChange) {
      const direction = deltaX < 0 ? 1 : -1;
      const targetIndex = this.state.currentSlide + direction;

      if (targetIndex >= 0 && targetIndex < this.slides.length) {
        this.goToSlide(targetIndex);
      } else {
        this.resetSlidePosition();
      }
    } else {
      this.resetSlidePosition();
    }

    this.state.touchStartX = null;
    this.state.touchMoveX = 0;
  }

  resetSlidePosition() {
    gsap.to(this.slides[this.state.currentSlide], {
      x: 0,
      duration: 0.3,
      ease: "power2.out",
    });

    if (this.state.currentSlide > 0) {
      gsap.to(this.slides[this.state.currentSlide - 1], {
        x: -this.container.offsetWidth,
        opacity: 0,
        duration: 0.3,
      });
    }
    if (this.state.currentSlide < this.slides.length - 1) {
      gsap.to(this.slides[this.state.currentSlide + 1], {
        x: this.container.offsetWidth,
        opacity: 0,
        duration: 0.3,
      });
    }
  }

  goToSlide(newIndex) {
    if (this.state.isTransitioning || newIndex === this.state.currentSlide)
      return;

    if (this.state.imageLoadStatus.get(newIndex) === "error") {
      console.warn(`Slide ${newIndex} failed to load`);
      return;
    }

    this.state.isTransitioning = true;

    if (this.navDots) {
      this.navDots[this.state.currentSlide].classList.remove("active");
      this.navDots[newIndex].classList.add("active");
    }

    this.slides[this.state.currentSlide].setAttribute("aria-hidden", "true");
    this.slides[newIndex].setAttribute("aria-hidden", "false");

    this.announceSlideChange(newIndex);

    this.transition(
      this.slides[this.state.currentSlide],
      this.slides[newIndex]
    );

    this.state.currentSlide = newIndex;

    if (this.config.loading.preloadNext) {
      const nextIndex = (newIndex + 1) % this.slides.length;
      if (this.state.imageLoadStatus.get(nextIndex) !== "loaded") {
        const nextSlide = this.slides[nextIndex];
        const style = window.getComputedStyle(nextSlide);
        const imageUrl = style.backgroundImage
          .slice(4, -1)
          .replace(/['"]/g, "");
        this.loadImage(imageUrl, nextIndex);
      }
    }
  }

  transition(oldSlide, newSlide) {
    this.slides.forEach((slide) => slide.classList.remove("active"));

    const tl = gsap.timeline({
      onComplete: () => {
        this.state.isTransitioning = false;
        newSlide.classList.add("active");
      },
    });

    tl.to(oldSlide, {
      opacity: 0,
      scale: this.config.zoomIntensity,
      duration: this.config.transitionDuration,
      ease: this.slideEase,
    });

    tl.fromTo(
      newSlide,
      {
        opacity: 0,
        scale: this.config.zoomIntensity - 0.05,
      },
      {
        opacity: 1,
        scale: 1,
        duration: this.config.transitionDuration,
        ease: this.slideEase,
      },
      0
    );

    return tl;
  }

  next() {
    const nextIndex = (this.state.currentSlide + 1) % this.slides.length;
    this.goToSlide(nextIndex);
  }

  previous() {
    const prevIndex =
      (this.state.currentSlide - 1 + this.slides.length) % this.slides.length;
    this.goToSlide(prevIndex);
  }

  pause() {
    this.state.isPaused = true;
    this.stopAutoplay();
    if (this.overlay) {
      this.overlay.classList.add("paused");
    }
  }

  resume() {
    if (!this.state.isPaused) return;

    this.state.isPaused = false;
    if (this.config.autoplay) {
      this.startAutoplay();
    }
    if (this.overlay) {
      this.overlay.classList.remove("paused");
    }
  }

  startAutoplay() {
    this.stopAutoplay();
    this.state.autoplayTimer = setInterval(() => {
      if (!this.state.isPaused) {
        this.next();
      }
    }, this.config.autoplayDuration);
  }

  stopAutoplay() {
    if (this.state.autoplayTimer) {
      clearInterval(this.state.autoplayTimer);
      this.state.autoplayTimer = null;
    }
  }

  destroy() {
    // Stop autoplay
    this.stopAutoplay();

    // Remove event listeners
    if (this.config.pauseOnHover) {
      this.container.removeEventListener("mouseenter", this.pause);
      this.container.removeEventListener("mouseleave", this.resume);
    }

    // Remove elements
    if (this.overlay) this.overlay.remove();
    if (this.loadingContainer) this.loadingContainer.remove();
    if (this.liveRegion) this.liveRegion.remove();

    // Remove navigation
    const navArrows = this.container.querySelector(".nav-arrows");
    const navDots = this.container.querySelector(".nav-dots-container");
    if (navArrows) navArrows.remove();
    if (navDots) navDots.remove();

    // Reset slides
    this.slides.forEach((slide) => {
      slide.removeAttribute("aria-hidden");
      slide.classList.remove("active", "touch-move");
      gsap.set(slide, { clearProps: "all" });
    });
  }
}
