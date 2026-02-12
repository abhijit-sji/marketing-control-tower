import { MessageSquare } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const FeedbackButton = () => {
  const navigate = useNavigate();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => navigate("/feedback/submit")}
            className="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full bg-gradient-primary text-white shadow-lg hover:shadow-xl hover:scale-110 transition-all duration-200 flex items-center justify-center group sm:h-12 sm:w-12 sm:bottom-4 sm:right-4"
            aria-label="Submit feedback"
          >
            <MessageSquare className="h-5 w-5 group-hover:scale-110 transition-transform duration-200" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="left">
          <p>Submit Feedback</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default FeedbackButton;
