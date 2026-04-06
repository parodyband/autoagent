import React from "react";
import { Box, Text } from "ink";

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

export class TuiErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log to stderr so it doesn't interfere with Ink rendering
    process.stderr.write(`[TUI crash] ${error.name}: ${error.message}\n${info.componentStack ?? ""}\n`);
  }

  render() {
    if (this.state.error) {
      return (
        <Box flexDirection="column" borderStyle="round" borderColor="red" padding={1}>
          <Text bold color="red">AutoAgent crashed</Text>
          <Text color="white">{this.state.error.name}: {this.state.error.message}</Text>
          {this.state.error.stack && (
            <Box marginTop={1}>
              <Text color="gray" dimColor>{this.state.error.stack.split("\n").slice(1, 5).join("\n")}</Text>
            </Box>
          )}
          <Box marginTop={1}>
            <Text color="yellow">Press Ctrl+C to restart.</Text>
          </Box>
        </Box>
      );
    }
    return this.props.children;
  }
}
