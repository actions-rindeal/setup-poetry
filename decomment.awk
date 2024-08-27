#!/usr/bin/awk -f

BEGIN {
    # Set up the pipe to gcc
    gcc_cmd = "gcc -fpreprocessed -dD -E -P -x c -"
}

# If the line starts with '#' (allowing for leading whitespace), print it directly
/^[[:space:]]*#/ {
    print $0
    next
}

# For all other lines, send them to gcc
{
    print $0 | gcc_cmd
}

END {
    # Close the pipe to gcc
    close(gcc_cmd)
}