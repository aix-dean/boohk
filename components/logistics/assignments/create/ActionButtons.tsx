import { Button } from '@/components/ui/button';
import { Loader2 } from "lucide-react";

export function ActionButtons({
  onSaveAsDraft,
  onSubmit,
  loading,
  generatingPDF,
}: {
  onSaveAsDraft: () => Promise<void>;
  onSubmit: () => Promise<void>;
  loading: boolean;
  generatingPDF: boolean;
}) {
  const isProcessing = loading || generatingPDF;

  return (
    <div
      style={{
        display: 'flex',
        position: 'absolute',
        bottom: '20px',
        left: '60%',
        transform: 'translateX(-50%)',
        width: '300px',
        height: '67px',
        flexShrink: 0,
        borderRadius: '50px',
        border: '1.5px solid var(--GREY, #C4C4C4)',
        background: '#FFF',
        boxShadow: '-2px 4px 10.5px -2px rgba(0, 0, 0, 0.25)',
        opacity: isProcessing ? 0.7 : 1,
        transition: 'opacity 0.2s ease-in-out',
      }}
    >
      <div className="flex justify-center items-center" style={{ width: '100%', gap: '10px' }}>
        <Button
          variant="ghost"
          onClick={onSaveAsDraft}
          disabled={isProcessing}
          style={{
            height: '27px',
            color: 'var(--Standard-Font-Color, #333)',
            textAlign: 'center',
            fontFamily: 'Inter',
            fontSize: '16px',
            fontStyle: 'normal',
            fontWeight: 700,
            lineHeight: '100%',
            textDecorationLine: 'underline',
            textDecorationStyle: 'solid',
            textDecorationSkipInk: 'auto',
            textDecorationThickness: 'auto',
            textUnderlineOffset: 'auto',
            textUnderlinePosition: 'from-font',
            padding: 0,
            cursor: isProcessing ? 'not-allowed' : 'pointer',
          }}
        >
          Save as Draft
        </Button>
        <Button
          onClick={onSubmit}
          disabled={isProcessing}
          style={{
            width: '126px',
            height: '27px',
            flexShrink: 0,
            borderRadius: '10px',
            background: isProcessing ? '#9CA3AF' : '#1D0BEB',
            color: 'var(--Color, #FFF)',
            textAlign: 'center',
            fontFamily: 'Inter',
            fontSize: '16px',
            fontStyle: 'normal',
            fontWeight: 700,
            lineHeight: '100%',
            cursor: isProcessing ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.2s ease-in-out',
          }}
        >
          {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {generatingPDF ? "Generating ..." : loading ? "Creating SA..." : "Generate SA"}
        </Button>
      </div>
    </div>
  );
}
