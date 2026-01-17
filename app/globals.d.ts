declare module "*.css";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "s-page": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & { heading?: string }, HTMLElement>;
      "s-card": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      "s-text": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & { tone?: string }, HTMLElement>;
      "s-stack": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & { gap?: string | number }, HTMLElement>;
      "s-heading": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      "s-section": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & { heading?: string }, HTMLElement>;
      "s-banner": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & { tone?: string }, HTMLElement>;
      "s-paragraph": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}
